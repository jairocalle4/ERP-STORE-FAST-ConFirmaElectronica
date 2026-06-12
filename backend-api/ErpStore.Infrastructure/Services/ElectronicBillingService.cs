using System.Text;
using System.Text.Json;
using System.Xml;
using ErpStore.Application.DTOs;
using ErpStore.Application.Interfaces;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QRCoder;

namespace ErpStore.Infrastructure.Services;

/// <summary>
/// Servicio de Facturación Electrónica SRI Ecuador.
/// Implementa la Ficha Técnica de Comprobantes Electrónicos Off-Line v2.1.0.
/// </summary>
public class ElectronicBillingService : IElectronicBillingService
{
    private readonly AppDbContext _context;
    private readonly ILogger<ElectronicBillingService> _logger;
    private readonly ISriXmlSigner _xmlSigner;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;

    // URLs de los Web Services SRI
    private const string URL_RECEPCION_PRUEBAS = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline";
    private const string URL_AUTORIZACION_PRUEBAS = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";
    private const string URL_RECEPCION_PRODUCCION = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline";
    private const string URL_AUTORIZACION_PRODUCCION = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";

    public ElectronicBillingService(
        AppDbContext context,
        ILogger<ElectronicBillingService> logger,
        ISriXmlSigner xmlSigner,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        _context = context;
        _logger = logger;
        _xmlSigner = xmlSigner;
        _configuration = configuration;
        _environment = environment;
        // QuestPDF license (Community es gratuito para proyectos open source)
        QuestPDF.Settings.License = LicenseType.Community;
    }

    // ─────────────────────────────────────────────────────────
    // FLUJO PRINCIPAL
    // ─────────────────────────────────────────────────────────

    public async Task<ElectronicBillingResult> EmitirFactura(int saleId)
    {
        var sale = await ObtenerVentaCompleta(saleId);
        if (sale == null)
            return Error("Venta no encontrada");

        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null)
            return Error("Configuración de empresa no encontrada");

        if (!company.ElectronicBillingEnabled)
            return Error("La facturación electrónica no está habilitada en la configuración");

        try
        {
            // 1. Calcular secuencial
            var secuencial = await ObtenerSiguienteSecuencial(company);
            var ambiente = company.SriEnvironment ?? "1";

            // 2. Generar clave de acceso y asegurar RUC de 13 dígitos
            var rucEmpresa = company.Ruc ?? "";
            if (rucEmpresa.Length == 10) rucEmpresa += "001";
            
            var claveAcceso = GenerarClaveAcceso(sale.Date, "01", rucEmpresa, ambiente,
                company.SriEstablishment ?? "001", company.SriPointOfIssue ?? "001", secuencial);

            // 3. Actualizar venta con datos FE preliminares
            sale.IsElectronic = true;
            sale.AccessKey = claveAcceso;
            sale.ElectronicStatus = "PENDIENTE";
            sale.NoteNumber = $"{company.SriEstablishment ?? "001"}-{company.SriPointOfIssue ?? "001"}-{secuencial.ToString().PadLeft(9, '0')}";
            await _context.SaveChangesAsync();

            // 4. Generar XML sin firma
            var xmlContent = GenerarXmlInterno(sale, company, claveAcceso, secuencial, ambiente, rucEmpresa);

            // 5. Firmar XML con .p12
            string xmlFirmado;
            SriXmlSignResult signResult;
            try
            {
                if (company.ElectronicSignatureFile == null || company.ElectronicSignatureFile.Length == 0)
                {
                    throw new InvalidOperationException(
                        "Firma electrónica: archivo .p12 no encontrado en la base de datos. " +
                        "Sube tu certificado en Ajustes → Facturación Electrónica.");
                }

                signResult = await _xmlSigner.SignXmlAsync(
                    xmlContent,
                    company.ElectronicSignatureFile,
                    company.ElectronicSignaturePassword);

                if (!signResult.Success || string.IsNullOrWhiteSpace(signResult.SignedXml))
                {
                    throw new InvalidOperationException(
                        $"Firma electrónica: {signResult.ErrorMessage ?? "la validación local de firma falló."}");
                }

                xmlFirmado = signResult.SignedXml;
                await GuardarDiagnosticoFirma(saleId, claveAcceso, xmlContent, xmlFirmado, signResult.Validation);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("Firma electrónica"))
            {
                // Sin firma.p12 — guardamos el XML sin firmar para desarrollo/pruebas de estructura
                sale.ElectronicStatus = "ERROR";
                sale.SriErrorMessage = ex.Message;
                await _context.SaveChangesAsync();
                return new ElectronicBillingResult
                {
                    Success = false,
                    Status = "ERROR",
                    AccessKey = claveAcceso,
                    ErrorMessage = ex.Message
                };
            }

            // 6. Guardar XML firmado localmente
            var xmlPath = await GuardarXml(saleId, claveAcceso, xmlFirmado);
            sale.XmlPath = xmlPath;
            await _context.SaveChangesAsync();

            // 7. Enviar al SRI y consultar autorización
            var resultado = await EnviarYAutorizar(xmlFirmado, claveAcceso, ambiente);

            // 8. Actualizar venta con resultado
            sale.AuthorizationNumber = resultado.AuthorizationNumber;
            sale.AuthorizationDate = resultado.AuthorizationDate;
            sale.ElectronicStatus = resultado.Status;
            sale.SriErrorMessage = resultado.ErrorMessage;
            resultado.AccessKey = claveAcceso;
            await _context.SaveChangesAsync();

            return resultado;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error emitiendo factura electrónica para venta {SaleId}", saleId);
            sale.ElectronicStatus = "ERROR";
            sale.SriErrorMessage = $"Error interno: {ex.Message}";
            await _context.SaveChangesAsync();
            return Error($"Error interno: {ex.Message}");
        }
    }

    // ─────────────────────────────────────────────────────────
    // CLAVE DE ACCESO (49 dígitos)
    // ─────────────────────────────────────────────────────────

    /// <summary>
    /// Genera la clave de acceso de 49 dígitos según la Ficha Técnica SRI.
    /// Formato: ddmmyyyy(8) + tipodoc(2) + ruc(13) + ambiente(1) + serie(6) + secuencial(9) + codigoNumerico(8) + tipoEmision(1) + verificador(1)
    /// </summary>
    public string GenerarClaveAcceso(DateTime fecha, string tipoDoc, string ruc, string ambiente,
        string establecimiento, string puntoEmision, int secuencial)
    {
        var fecha8 = fecha.ToString("ddMMyyyy");
        var serie = $"{establecimiento.PadLeft(3, '0')}{puntoEmision.PadLeft(3, '0')}";
        var sec9 = secuencial.ToString().PadLeft(9, '0');
        var codigoNum = new Random().Next(10000000, 99999999).ToString();
        var tipoEmision = "1"; // 1 = Normal

        var clave48 = $"{fecha8}{tipoDoc}{ruc}{ambiente}{serie}{sec9}{codigoNum}{tipoEmision}";
        var verificador = CalcularModulo11(clave48);

        return $"{clave48}{verificador}";
    }

    private static int CalcularModulo11(string clave)
    {
        int[] coeficientes = { 2, 3, 4, 5, 6, 7 };
        int suma = 0;
        int coefIdx = 0;

        for (int i = clave.Length - 1; i >= 0; i--)
        {
            suma += int.Parse(clave[i].ToString()) * coeficientes[coefIdx % 6];
            coefIdx++;
        }

        int residuo = suma % 11;
        int verificador = 11 - residuo;

        return verificador switch
        {
            11 => 0,
            10 => 1,
            _ => verificador
        };
    }

    // ─────────────────────────────────────────────────────────
    // GENERACIÓN DE XML (Ficha Técnica SRI v2.1.0)
    // ─────────────────────────────────────────────────────────

    public async Task<string> GenerarXml(int saleId)
    {
        var sale = await ObtenerVentaCompleta(saleId);
        if (sale == null) throw new Exception("Venta no encontrada");

        var company = await _context.CompanySettings.FirstOrDefaultAsync()
            ?? throw new Exception("Configuración de empresa no encontrada");

        var secuencial = int.TryParse(sale.NoteNumber?.Split('-').LastOrDefault(), out var s) ? s : 1;
        var ambiente = company.SriEnvironment ?? "1";
        
        // El SRI exige estrictamente 13 dígitos para el RUC. Si el usuario ingresó solo su cédula (10 dígitos), añadir '001'.
        var rucEmpresa = company.Ruc ?? "";
        if (rucEmpresa.Length == 10) rucEmpresa += "001";
        
        var claveAcceso = sale.AccessKey ?? GenerarClaveAcceso(sale.Date, "01", rucEmpresa, ambiente,
            company.SriEstablishment ?? "001", company.SriPointOfIssue ?? "001", secuencial);

        return GenerarXmlInterno(sale, company, claveAcceso, secuencial, ambiente, rucEmpresa);
    }

    public async Task<SriXmlDebugSignResponseDto> GenerarDiagnosticoFirma(int saleId)
    {
        if (!DebeGuardarDiagnosticoFirma())
            throw new UnauthorizedAccessException("Diagnostico de firma SRI no disponible en este entorno.");

        var sale = await ObtenerVentaCompleta(saleId)
            ?? throw new InvalidOperationException("Venta no encontrada");

        var company = await _context.CompanySettings.FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Configuracion de empresa no encontrada");

        if (company.ElectronicSignatureFile == null || company.ElectronicSignatureFile.Length == 0)
            throw new InvalidOperationException("Firma electronica: archivo .p12/.pfx no encontrado.");

        var warnings = new List<string> { "Diagnostico local: no se envio ningun XML al SRI." };
        var ambiente = company.SriEnvironment ?? "1";
        if (ambiente != "1" && ambiente != "2")
            warnings.Add("SriEnvironment no es '1' ni '2'; el envio normal usaria endpoints de pruebas por fallback.");

        var secuencial = ObtenerSecuencialParaDiagnostico(sale, company);
        var rucEmpresa = company.Ruc ?? "";
        if (rucEmpresa.Length == 10) rucEmpresa += "001";

        var claveAcceso = sale.AccessKey ?? GenerarClaveAcceso(
            sale.Date,
            "01",
            rucEmpresa,
            ambiente,
            company.SriEstablishment ?? "001",
            company.SriPointOfIssue ?? "001",
            secuencial);

        if (string.IsNullOrWhiteSpace(sale.AccessKey))
            warnings.Add("La clave de acceso fue generada solo para diagnostico y no fue persistida.");

        var unsignedXml = GenerarXmlInterno(sale, company, claveAcceso, secuencial, ambiente, rucEmpresa);
        var signResult = await _xmlSigner.SignXmlAsync(
            unsignedXml,
            company.ElectronicSignatureFile,
            company.ElectronicSignaturePassword);

        if (string.IsNullOrWhiteSpace(signResult.SignedXml))
            throw new InvalidOperationException($"No se pudo generar XML firmado: {signResult.ErrorMessage}");

        if (signResult.Validation?.IsValid != true)
            warnings.Add(signResult.Validation?.ErrorMessage ?? "La validacion local de la firma no fue exitosa.");

        var diagnosticPath = await GuardarDiagnosticoFirmaDebug(
            saleId,
            unsignedXml,
            signResult.SignedXml,
            signResult);

        var endpoints = ObtenerEndpointsSri(ambiente);

        return new SriXmlDebugSignResponseDto
        {
            SaleId = saleId,
            Ambiente = ambiente == "2" ? "2 - Produccion" : "1 - Pruebas",
            EndpointSri = new SriEndpointPreviewDto
            {
                Recepcion = endpoints.Recepcion,
                Autorizacion = endpoints.Autorizacion
            },
            ClaveAccesoMasked = MaskAccessKey(claveAcceso),
            IsValid = signResult.Validation?.IsValid == true,
            IsKeyInfoReferenced = signResult.Validation?.IsKeyInfoReferenced == true,
            IsSignedPropertiesReferenced = signResult.Validation?.IsSignedPropertiesReferenced == true,
            HasSignedDataObjectProperties = signResult.Validation?.HasSignedDataObjectProperties == true,
            HasDataObjectFormat = signResult.Validation?.HasDataObjectFormat == true,
            CertificateThumbprintMasked = signResult.CertificateThumbprintMasked,
            DiagnosticPath = diagnosticPath,
            Warnings = warnings
        };
    }

    private string GenerarXmlInterno(Sale sale, CompanySetting company, string claveAcceso, int secuencial, string ambiente, string rucEmpresa)
    {
        // Determinar datos del comprador
        var (tipoIdComprador, idComprador, razonComprador) = ObtenerDatosComprador(sale.Client);

        // Calcular totales e IVA según régimen
        var totalSinImpuestos = sale.SaleDetails.Sum(d => d.Subtotal);
        var esRimpeNegocioPopular = company.TributaryRegime == "RIMPE_NEGOCIO_POPULAR";

        decimal baseImponible0 = 0m, baseImponible = 0m;
        decimal valorIva = 0m;
        int codigoPorcentajeIva;

        if (esRimpeNegocioPopular)
        {
            // RIMPE Negocio Popular: IVA 0%, base imponible es el total
            baseImponible0 = totalSinImpuestos;
            codigoPorcentajeIva = 0; // 0 = 0%
        }
        else
        {
            // Régimen General o RIMPE Emprendedor: IVA configurable
            baseImponible = totalSinImpuestos;
            var ivaRate = company.IvaRate / 100m;
            valorIva = Math.Round(baseImponible * ivaRate, 2);
            codigoPorcentajeIva = company.IvaRate switch
            {
                12m => 2,
                15m => 4,
                5m  => 5,
                _   => 4  // Por defecto 15%
            };
        }

        var baseActual = esRimpeNegocioPopular ? baseImponible0 : baseImponible;
        var importeTotal = baseActual + valorIva;

        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<factura id=\"comprobante\" version=\"2.1.0\">");

        // ── infoTributaria ──
        sb.AppendLine("  <infoTributaria>");
        sb.AppendLine($"    <ambiente>{ambiente}</ambiente>");
        sb.AppendLine("    <tipoEmision>1</tipoEmision>");
        sb.AppendLine($"    <razonSocial>{EscapeXml(company.SocialReason ?? company.Name)}</razonSocial>");
        sb.AppendLine($"    <nombreComercial>{EscapeXml(company.CommercialName ?? company.Name)}</nombreComercial>");
        sb.AppendLine($"    <ruc>{rucEmpresa}</ruc>");
        sb.AppendLine($"    <claveAcceso>{claveAcceso}</claveAcceso>");
        sb.AppendLine("    <codDoc>01</codDoc>");
        sb.AppendLine($"    <estab>{(company.SriEstablishment ?? "001").PadLeft(3, '0')}</estab>");
        sb.AppendLine($"    <ptoEmi>{(company.SriPointOfIssue ?? "001").PadLeft(3, '0')}</ptoEmi>");
        sb.AppendLine($"    <secuencial>{secuencial.ToString().PadLeft(9, '0')}</secuencial>");
        sb.AppendLine($"    <dirMatriz>{EscapeXml(company.Address)}</dirMatriz>");
        if (company.TributaryRegime == "RIMPE_NEGOCIO_POPULAR")
        {
            sb.AppendLine("    <contribuyenteRimpe>CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</contribuyenteRimpe>");
        }
        else if (company.TributaryRegime == "RIMPE_EMPRENDEDOR")
        {
            sb.AppendLine("    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>");
        }
        sb.AppendLine("  </infoTributaria>");

        // ── infoFactura ──
        sb.AppendLine("  <infoFactura>");
        sb.AppendLine($"    <fechaEmision>{sale.Date:dd/MM/yyyy}</fechaEmision>");
        sb.AppendLine($"    <dirEstablecimiento>{EscapeXml(company.Address)}</dirEstablecimiento>");
        sb.AppendLine("    <obligadoContabilidad>NO</obligadoContabilidad>");
        sb.AppendLine($"    <tipoIdentificacionComprador>{tipoIdComprador}</tipoIdentificacionComprador>");
        sb.AppendLine($"    <razonSocialComprador>{EscapeXml(razonComprador)}</razonSocialComprador>");
        sb.AppendLine($"    <identificacionComprador>{idComprador}</identificacionComprador>");
        sb.AppendLine($"    <direccionComprador>{EscapeXml(sale.Client?.Address ?? "N/A")}</direccionComprador>");
        sb.AppendLine($"    <totalSinImpuestos>{totalSinImpuestos:F2}</totalSinImpuestos>");
        sb.AppendLine("    <totalDescuento>0.00</totalDescuento>");
        sb.AppendLine("    <totalConImpuestos>");
        sb.AppendLine("      <totalImpuesto>");
        sb.AppendLine("        <codigo>2</codigo>");
        sb.AppendLine($"        <codigoPorcentaje>{codigoPorcentajeIva}</codigoPorcentaje>");
        sb.AppendLine($"        <baseImponible>{baseActual:F2}</baseImponible>");
        sb.AppendLine($"        <valor>{valorIva:F2}</valor>");
        sb.AppendLine("      </totalImpuesto>");
        sb.AppendLine("    </totalConImpuestos>");
        sb.AppendLine("    <propina>0.00</propina>");
        sb.AppendLine($"    <importeTotal>{importeTotal:F2}</importeTotal>");
        sb.AppendLine("    <moneda>DOLAR</moneda>");
        sb.AppendLine("    <pagos>");
        sb.AppendLine("      <pago>");
        sb.AppendLine($"        <formaPago>{ObtenerCodigoFormaPago(sale.PaymentMethod)}</formaPago>");
        sb.AppendLine($"        <total>{importeTotal:F2}</total>");
        sb.AppendLine("        <plazo>0</plazo>");
        sb.AppendLine("        <unidadTiempo>dias</unidadTiempo>");
        sb.AppendLine("      </pago>");
        sb.AppendLine("    </pagos>");
        sb.AppendLine("  </infoFactura>");

        // ── detalles ──
        sb.AppendLine("  <detalles>");
        foreach (var detail in sale.SaleDetails)
        {
            var prod = detail.Product;
            var precioUnitario = detail.UnitPrice;
            var subtotalDetalle = detail.Subtotal;
            var ivaDetallado = esRimpeNegocioPopular ? 0m : Math.Round(subtotalDetalle * (company.IvaRate / 100m), 2);

            sb.AppendLine("    <detalle>");
            sb.AppendLine($"      <codigoPrincipal>{EscapeXml(prod?.SKU ?? detail.ProductId.ToString())}</codigoPrincipal>");
            sb.AppendLine($"      <descripcion>{EscapeXml(prod?.Name ?? "Producto")}</descripcion>");
            sb.AppendLine($"      <cantidad>{detail.Quantity}.000000</cantidad>");
            sb.AppendLine($"      <precioUnitario>{precioUnitario:F6}</precioUnitario>");
            sb.AppendLine("      <descuento>0.00</descuento>");
            sb.AppendLine($"      <precioTotalSinImpuesto>{subtotalDetalle:F2}</precioTotalSinImpuesto>");
            sb.AppendLine("      <impuestos>");
            sb.AppendLine("        <impuesto>");
            sb.AppendLine("          <codigo>2</codigo>");
            sb.AppendLine($"          <codigoPorcentaje>{codigoPorcentajeIva}</codigoPorcentaje>");
            sb.AppendLine($"          <tarifa>{(esRimpeNegocioPopular ? 0 : company.IvaRate):F2}</tarifa>");
            sb.AppendLine($"          <baseImponible>{subtotalDetalle:F2}</baseImponible>");
            sb.AppendLine($"          <valor>{ivaDetallado:F2}</valor>");
            sb.AppendLine("        </impuesto>");
            sb.AppendLine("      </impuestos>");
            sb.AppendLine("    </detalle>");
        }
        sb.AppendLine("  </detalles>");

        // ── infoAdicional (OBLIGATORIO para RIMPE) ──
        sb.AppendLine("  <infoAdicional>");
        if (!string.IsNullOrEmpty(company.Phone))
            sb.AppendLine($"    <campoAdicional nombre=\"Teléfono\">{EscapeXml(company.Phone)}</campoAdicional>");
        if (!string.IsNullOrEmpty(company.Email))
            sb.AppendLine($"    <campoAdicional nombre=\"Email\">{EscapeXml(company.Email)}</campoAdicional>");
        if (!string.IsNullOrEmpty(sale.Client?.Email))
            sb.AppendLine($"    <campoAdicional nombre=\"EmailCliente\">{EscapeXml(sale.Client.Email)}</campoAdicional>");
        if (!string.IsNullOrEmpty(sale.Observation))
            sb.AppendLine($"    <campoAdicional nombre=\"Observacion\">{EscapeXml(sale.Observation)}</campoAdicional>");

        // Leyenda RIMPE — OBLIGATORIA
        var leyendaRimpe = company.TributaryRegime switch
        {
            "RIMPE_NEGOCIO_POPULAR" => "Contribuyente Negocio Popular - Régimen RIMPE",
            "RIMPE_EMPRENDEDOR"     => "Contribuyente Régimen RIMPE",
            _                       => null
        };
        if (leyendaRimpe != null)
            sb.AppendLine($"    <campoAdicional nombre=\"Contribuyente\">{leyendaRimpe}</campoAdicional>");

        sb.AppendLine("  </infoAdicional>");
        sb.AppendLine("</factura>");

        return sb.ToString();
    }

    // ─────────────────────────────────────────────────────────
    // ENVÍO AL SRI (Web Services SOAP)
    // ─────────────────────────────────────────────────────────

    private async Task<ElectronicBillingResult> EnviarYAutorizar(string xmlFirmado, string claveAcceso, string ambiente)
    {
        try
        {
            var base64Xml = Convert.ToBase64String(Encoding.UTF8.GetBytes(xmlFirmado));
            var urlRecepcion = ambiente == "2" ? URL_RECEPCION_PRODUCCION : URL_RECEPCION_PRUEBAS;
            var urlAutorizacion = ambiente == "2" ? URL_AUTORIZACION_PRODUCCION : URL_AUTORIZACION_PRUEBAS;

            // Enviar al Web Service de Recepción
            var recepcionOk = await EnviarRecepcion(base64Xml, urlRecepcion);
            if (!recepcionOk.Success)
                return recepcionOk;

            // Esperar 1 segundo y consultar autorización
            await Task.Delay(1500);
            return await ConsultarAutorizacion(claveAcceso, urlAutorizacion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en comunicación con SRI para clave {ClaveAcceso}", claveAcceso);
            return Error($"Error de comunicación con SRI: {ex.Message}");
        }
    }

    private async Task<ElectronicBillingResult> EnviarRecepcion(string base64Xml, string urlRecepcion)
    {
        // Construir petición SOAP manualmente (compatible con .NET 9)
        var soapEnvelope = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<soapenv:Envelope xmlns:soapenv=""http://schemas.xmlsoap.org/soap/envelope/"" 
                  xmlns:ec=""http://ec.gob.sri.ws.recepcion"">
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>{base64Xml}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>";

        using var httpClient = new HttpClient();
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");
        content.Headers.Add("SOAPAction", "\"\"");

        var response = await httpClient.PostAsync(urlRecepcion, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("SRI Recepción Response: {Response}", responseBody);

        // Parsear respuesta XML del SRI
        if (responseBody.Contains("RECIBIDA"))
            return new ElectronicBillingResult { Success = true, Status = "PENDIENTE" };

        // Extraer mensajes de error del XML de respuesta
        var mensajeError = ExtraerMensajeError(responseBody);
        return Error($"SRI rechazó el comprobante: {mensajeError}");
    }

    private async Task<ElectronicBillingResult> ConsultarAutorizacion(string claveAcceso, string urlAutorizacion)
    {
        var soapEnvelope = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<soapenv:Envelope xmlns:soapenv=""http://schemas.xmlsoap.org/soap/envelope/"" 
                  xmlns:ec=""http://ec.gob.sri.ws.autorizacion"">
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>{claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>";

        using var httpClient = new HttpClient();
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");
        content.Headers.Add("SOAPAction", "\"\"");

        var response = await httpClient.PostAsync(urlAutorizacion, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("SRI Autorización Response: {Response}", responseBody);

        return ParsearRespuestaAutorizacion(responseBody, claveAcceso);
    }

    private static ElectronicBillingResult ParsearRespuestaAutorizacion(string xml, string claveAcceso)
    {
        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xml);
            var nsMgr = new XmlNamespaceManager(doc.NameTable);
            nsMgr.AddNamespace("soap", "http://schemas.xmlsoap.org/soap/envelope/");

            var estado = doc.SelectSingleNode("//estado")?.InnerText?.Trim();
            var numeroAutorizacion = doc.SelectSingleNode("//numeroAutorizacion")?.InnerText?.Trim();
            var fechaAutorizacionStr = doc.SelectSingleNode("//fechaAutorizacion")?.InnerText?.Trim();

            if (estado == "AUTORIZADO")
            {
                DateTime.TryParse(fechaAutorizacionStr, out var fechaAuth);
                return new ElectronicBillingResult
                {
                    Success = true,
                    Status = "AUTORIZADO",
                    AccessKey = claveAcceso,
                    AuthorizationNumber = numeroAutorizacion,
                    AuthorizationDate = fechaAuth
                };
            }

            var mensajes = doc.SelectNodes("//mensaje")?.Cast<XmlNode>()
                .Select(n => n.InnerText.Trim()).ToList() ?? new List<string>();
            return Error($"NO AUTORIZADO: {string.Join("; ", mensajes)}");
        }
        catch (Exception ex)
        {
            return Error($"Error parseando respuesta SRI: {ex.Message}");
        }
    }

    private static string ExtraerMensajeError(string xmlResponse)
    {
        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xmlResponse);
            var mensajes = doc.SelectNodes("//mensaje")?.Cast<XmlNode>()
                .Select(n => n.InnerText.Trim()) ?? Enumerable.Empty<string>();
            return string.Join("; ", mensajes);
        }
        catch
        {
            return "Error desconocido en la respuesta del SRI";
        }
    }

    // ─────────────────────────────────────────────────────────
    // GENERACIÓN DE RIDE (PDF con QuestPDF)
    // ─────────────────────────────────────────────────────────

    public async Task<byte[]> GenerarRide(int saleId)
    {
        var sale = await ObtenerVentaCompleta(saleId);
        if (sale == null) throw new Exception("Venta no encontrada");

        var company = await _context.CompanySettings.FirstOrDefaultAsync()
            ?? throw new Exception("Configuración de empresa no encontrada");

        var (_, _, razonComprador) = ObtenerDatosComprador(sale.Client);
        var esRimpe = company.TributaryRegime == "RIMPE_NEGOCIO_POPULAR";
        var totalSinImpuestos = sale.SaleDetails.Sum(d => d.Subtotal);
        var valorIva = esRimpe ? 0m : Math.Round(totalSinImpuestos * (company.IvaRate / 100m), 2);
        var total = totalSinImpuestos + valorIva;

        // Generar QR con la clave de acceso
        byte[]? qrBytes = null;
        if (!string.IsNullOrEmpty(sale.AccessKey))
        {
            using var qrGenerator = new QRCodeGenerator();
            var qrData = qrGenerator.CreateQrCode(sale.AccessKey, QRCodeGenerator.ECCLevel.M);
            using var qrCode = new PngByteQRCode(qrData);
            qrBytes = qrCode.GetGraphic(5);
        }

        var pdfBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                page.Content().Column(col =>
                {
                    // ── ENCABEZADO ──
                    col.Item().Row(row =>
                    {
                        row.RelativeItem(2).Column(c =>
                        {
                            c.Item().Text(company.SocialReason ?? company.Name)
                                .Bold().FontSize(12);
                            c.Item().Text($"RUC: {company.Ruc}");
                            c.Item().Text($"Dir: {company.Address}");
                            if (!string.IsNullOrEmpty(company.Phone))
                                c.Item().Text($"Telf: {company.Phone}");
                            if (!string.IsNullOrEmpty(company.Email))
                                c.Item().Text($"Email: {company.Email}");
                        });

                        row.RelativeItem().Border(1).Padding(6).Column(c =>
                        {
                            c.Item().AlignCenter().Text("FACTURA").Bold().FontSize(11);
                            c.Item().AlignCenter().Text($"No. {sale.NoteNumber ?? "---"}");
                            c.Item().AlignCenter().Text($"FECHA: {sale.Date:dd/MM/yyyy}");
                            if (sale.AuthorizationNumber != null)
                            {
                                c.Item().PaddingTop(4).Text("AUTORIZACIÓN SRI:").Bold().FontSize(7);
                                c.Item().Text(sale.AuthorizationNumber).FontSize(7);
                            }
                            if (!string.IsNullOrEmpty(company.SriEnvironment) && company.SriEnvironment == "1")
                                c.Item().AlignCenter().Text("AMBIENTE: PRUEBAS").FontSize(7).FontColor("#FF0000");
                            else
                                c.Item().AlignCenter().Text("AMBIENTE: PRODUCCIÓN").FontSize(7);
                        });
                    });

                    col.Item().PaddingTop(8).BorderBottom(1).Row(row => { });

                    // ── DATOS DEL COMPRADOR ──
                    col.Item().PaddingTop(6).Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                        t.Cell().Text("CLIENTE:").Bold();
                        t.Cell().Text(razonComprador);
                        t.Cell().Text("IDENTIFICACIÓN:").Bold();
                        t.Cell().Text(sale.Client?.CedulaRuc ?? "9999999999999");
                        t.Cell().Text("DIRECCIÓN:").Bold();
                        t.Cell().Text(sale.Client?.Address ?? "N/A");
                        t.Cell().Text("FORMA DE PAGO:").Bold();
                        t.Cell().Text(sale.PaymentMethod);
                    });

                    col.Item().PaddingTop(8).BorderBottom(1).Row(row => { });

                    // ── DETALLE DE PRODUCTOS ──
                    col.Item().PaddingTop(6).Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(50);
                            c.RelativeColumn();
                            c.ConstantColumn(60);
                            c.ConstantColumn(70);
                            c.ConstantColumn(70);
                        });

                        // Header
                        t.Header(h =>
                        {
                            h.Cell().Background("#2c3e50").Padding(4).Text("CANT").FontColor("#FFFFFF").Bold().FontSize(8);
                            h.Cell().Background("#2c3e50").Padding(4).Text("DESCRIPCIÓN").FontColor("#FFFFFF").Bold().FontSize(8);
                            h.Cell().Background("#2c3e50").Padding(4).AlignRight().Text("P. UNIT").FontColor("#FFFFFF").Bold().FontSize(8);
                            h.Cell().Background("#2c3e50").Padding(4).AlignRight().Text("DESCUENTO").FontColor("#FFFFFF").Bold().FontSize(8);
                            h.Cell().Background("#2c3e50").Padding(4).AlignRight().Text("SUBTOTAL").FontColor("#FFFFFF").Bold().FontSize(8);
                        });

                        foreach (var detail in sale.SaleDetails)
                        {
                            t.Cell().Padding(3).Text(detail.Quantity.ToString());
                            t.Cell().Padding(3).Text(detail.Product?.Name ?? $"Producto #{detail.ProductId}");
                            t.Cell().Padding(3).AlignRight().Text($"${detail.UnitPrice:F2}");
                            t.Cell().Padding(3).AlignRight().Text("$0.00");
                            t.Cell().Padding(3).AlignRight().Text($"${detail.Subtotal:F2}");
                        }
                    });

                    col.Item().PaddingTop(4).BorderBottom(1).Row(row => { });

                    // ── TOTALES ──
                    col.Item().PaddingTop(6).AlignRight().Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.ConstantColumn(150); c.ConstantColumn(90); });
                        t.Cell().Text("SUBTOTAL (sin IVA):").Bold();
                        t.Cell().AlignRight().Text($"${totalSinImpuestos:F2}");
                        t.Cell().Text($"IVA {(esRimpe ? "0" : company.IvaRate.ToString("F0"))}%:").Bold();
                        t.Cell().AlignRight().Text($"${valorIva:F2}");
                        t.Cell().Background("#2c3e50").Padding(4).Text("TOTAL:").FontColor("#FFFFFF").Bold();
                        t.Cell().Background("#2c3e50").Padding(4).AlignRight().Text($"${total:F2}").FontColor("#FFFFFF").Bold();
                    });

                    // ── LEYENDA RIMPE ──
                    var leyenda = company.TributaryRegime switch
                    {
                        "RIMPE_NEGOCIO_POPULAR" => "Contribuyente Negocio Popular – Régimen RIMPE",
                        "RIMPE_EMPRENDEDOR"     => "Contribuyente Régimen RIMPE",
                        _                       => null
                    };
                    if (leyenda != null)
                        col.Item().PaddingTop(10).AlignCenter().Text(leyenda).Bold().FontSize(8);

                    // ── QR + CLAVE DE ACCESO ──
                    if (qrBytes != null && !string.IsNullOrEmpty(sale.AccessKey))
                    {
                        col.Item().PaddingTop(10).Row(row =>
                        {
                            row.ConstantItem(80).Image(qrBytes);
                            row.RelativeItem().PaddingLeft(10).Column(c =>
                            {
                                c.Item().Text("CLAVE DE ACCESO:").Bold().FontSize(7);
                                c.Item().Text(sale.AccessKey).FontSize(6.5f);
                                if (sale.AuthorizationDate.HasValue)
                                {
                                    c.Item().PaddingTop(4).Text("FECHA AUTORIZACIÓN:").Bold().FontSize(7);
                                    c.Item().Text(sale.AuthorizationDate.Value.ToString("dd/MM/yyyy HH:mm:ss")).FontSize(7);
                                }
                                c.Item().PaddingTop(4).Text("ESTADO SRI:").Bold().FontSize(7);
                                c.Item().Text(sale.ElectronicStatus ?? "---").FontSize(7);
                            });
                        });
                    }

                    // ── PIE ──
                    col.Item().PaddingTop(15).AlignCenter().Text("— GRACIAS POR SU COMPRA —").FontSize(8);
                });
            });
        }).GeneratePdf();

        return pdfBytes;
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────

    public async Task<string?> ObtenerRutaXml(int saleId)
    {
        var sale = await _context.Sales.FindAsync(saleId);
        return sale?.XmlPath;
    }

    private async Task<Sale?> ObtenerVentaCompleta(int saleId)
    {
        return await _context.Sales
            .Include(s => s.Client)
            .Include(s => s.Employee)
            .Include(s => s.SaleDetails)
                .ThenInclude(d => d.Product)
            .FirstOrDefaultAsync(s => s.Id == saleId);
    }

    private async Task<int> ObtenerSiguienteSecuencial(CompanySetting company)
    {
        company.CurrentSequence++;
        await _context.SaveChangesAsync();
        return company.CurrentSequence;
    }

    private (string tipoId, string id, string razonSocial) ObtenerDatosComprador(Client? client)
    {
        if (client == null || string.IsNullOrEmpty(client.CedulaRuc))
            return ("07", "9999999999999", "CONSUMIDOR FINAL");

        var cedRuc = client.CedulaRuc.Trim();

        // Auto-detectar tipo
        var tipo = client.IdentificationType?.ToUpper() ?? (cedRuc.Length == 13 ? "RUC" : cedRuc.Length == 10 ? "CEDULA" : "PASAPORTE");

        var codigoSri = tipo switch
        {
            "RUC"    => "04",
            "CEDULA" => "05",
            "PASAPORTE" => "06",
            _ => "07"
        };

        return (codigoSri, cedRuc, client.Name ?? "CONSUMIDOR FINAL");
    }

    private static string ObtenerCodigoFormaPago(string metodoPago) => metodoPago?.ToLower() switch
    {
        "efectivo"     => "01",
        "tarjeta"      => "16",
        "transferencia" => "20",
        "cheque"       => "03",
        _              => "01"
    };

    private static string EscapeXml(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        return text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
                   .Replace("\"", "&quot;").Replace("'", "&apos;");
    }

    private async Task<string> GuardarXml(int saleId, string claveAcceso, string xmlContent)
    {
        var folder = Path.Combine("wwwroot", "electronic-docs", saleId.ToString());
        Directory.CreateDirectory(folder);
        var path = Path.Combine(folder, $"{claveAcceso}.xml");
        await File.WriteAllTextAsync(path, xmlContent, Encoding.UTF8);
        return path;
    }

    private async Task GuardarDiagnosticoFirma(
        int saleId,
        string claveAcceso,
        string unsignedXml,
        string signedXml,
        SriXmlSignatureValidationResult? validation)
    {
        if (!DebeGuardarDiagnosticoFirma())
            return;

        var folder = Path.Combine("wwwroot", "electronic-docs", saleId.ToString(), "diagnostics");
        Directory.CreateDirectory(folder);

        await File.WriteAllTextAsync(
            Path.Combine(folder, $"{claveAcceso}_unsigned.xml"),
            unsignedXml,
            Encoding.UTF8);
        await File.WriteAllTextAsync(
            Path.Combine(folder, $"{claveAcceso}_signed.xml"),
            signedXml,
            Encoding.UTF8);

        var validationJson = JsonSerializer.Serialize(
            validation ?? new SriXmlSignatureValidationResult { ErrorMessage = "Validacion no disponible." },
            new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(
            Path.Combine(folder, $"{claveAcceso}_validation.json"),
            validationJson,
            Encoding.UTF8);

        _logger.LogInformation(
            "Diagnostico local de firma SRI guardado para venta {SaleId} y clave {ClaveAcceso}.",
            saleId,
            claveAcceso);
    }

    private async Task<string> GuardarDiagnosticoFirmaDebug(
        int saleId,
        string unsignedXml,
        string signedXml,
        SriXmlSignResult signResult)
    {
        var folder = Path.Combine(
            "wwwroot",
            "electronic-docs",
            saleId.ToString(),
            "diagnostics",
            $"debug-{DateTime.UtcNow:yyyyMMddHHmmssfff}");
        Directory.CreateDirectory(folder);

        await File.WriteAllTextAsync(Path.Combine(folder, "unsigned.xml"), unsignedXml, Encoding.UTF8);
        await File.WriteAllTextAsync(Path.Combine(folder, "signed.xml"), signedXml, Encoding.UTF8);

        var validationPayload = new
        {
            generatedAtUtc = DateTime.UtcNow,
            signResult.SignatureId,
            signResult.SignedPropertiesId,
            signResult.KeyInfoId,
            signResult.ObjectId,
            signResult.SignatureMethod,
            signResult.DigestMethod,
            signResult.UsesSha1,
            signResult.CertificateThumbprintMasked,
            validation = signResult.Validation
        };

        var validationJson = JsonSerializer.Serialize(
            validationPayload,
            new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(Path.Combine(folder, "_validation.json"), validationJson, Encoding.UTF8);

        var fullPath = Path.GetFullPath(folder);
        _logger.LogInformation(
            "Diagnostico debug de firma SRI guardado para venta {SaleId} en {DiagnosticPath}.",
            saleId,
            fullPath);
        return fullPath;
    }

    private bool DebeGuardarDiagnosticoFirma()
    {
        return _environment.IsDevelopment()
            || LeerBooleanoConfiguracion("SRI_XML_SIGNATURE_DIAGNOSTICS_ENABLED")
            || LeerBooleanoConfiguracion("Sri:XmlSignatureDiagnosticsEnabled");
    }

    private bool LeerBooleanoConfiguracion(string key)
    {
        return bool.TryParse(_configuration[key], out var enabled) && enabled;
    }

    private static int ObtenerSecuencialParaDiagnostico(Sale sale, CompanySetting company)
    {
        if (int.TryParse(sale.NoteNumber?.Split('-').LastOrDefault(), out var secuencial) && secuencial > 0)
            return secuencial;

        return company.CurrentSequence + 1;
    }

    private static (string Recepcion, string Autorizacion) ObtenerEndpointsSri(string ambiente)
    {
        return ambiente == "2"
            ? (URL_RECEPCION_PRODUCCION, URL_AUTORIZACION_PRODUCCION)
            : (URL_RECEPCION_PRUEBAS, URL_AUTORIZACION_PRUEBAS);
    }

    private static string MaskAccessKey(string accessKey)
    {
        if (string.IsNullOrWhiteSpace(accessKey))
            return string.Empty;

        return accessKey.Length <= 12
            ? "****"
            : $"{accessKey[..6]}...{accessKey[^6..]}";
    }

    private static ElectronicBillingResult Error(string mensaje) => new()
    {
        Success = false,
        Status = "ERROR",
        ErrorMessage = mensaje
    };
}
