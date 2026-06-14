using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using ErpStore.Application.Interfaces;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
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

    // URLs de los Web Services SRI
    private const string URL_RECEPCION_PRUEBAS = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline";
    private const string URL_AUTORIZACION_PRUEBAS = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";
    private const string URL_RECEPCION_PRODUCCION = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline";
    private const string URL_AUTORIZACION_PRODUCCION = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";

    public ElectronicBillingService(AppDbContext context, ILogger<ElectronicBillingService> logger)
    {
        _context = context;
        _logger = logger;
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
            try
            {
                xmlFirmado = await FirmarXml(xmlContent, company);
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
    // FIRMA XML (XAdES-BES con .p12)
    // ─────────────────────────────────────────────────────────

    /// <summary>
    /// Firma el XML con XAdES-BES usando el certificado .p12 del contribuyente.
    /// Cumple la Ficha Técnica de Comprobantes Electrónicos SRI Ecuador v2.1.0.
    /// Algoritmos: RSA-SHA1 (firma), SHA1 (digest de referencias), C14N (canonicalización).
    /// </summary>
    private class XadesSignedXml : SignedXml
    {
        public XadesSignedXml(XmlDocument document) : base(document) { }
        
        public override XmlElement? GetIdElement(XmlDocument? document, string idValue)
        {
            if (document == null) return null;
            
            // 1. Intentar con el comportamiento base
            var element = base.GetIdElement(document, idValue);
            if (element != null) return element;

            // 2. Intentar buscar por ID de manera manual en el documento principal
            var nodeList = document.SelectNodes($"//*[@id='{idValue}'] | //*[@Id='{idValue}']");
            if (nodeList != null && nodeList.Count > 0)
                return nodeList[0] as XmlElement;

            // 3. Buscar en los DataObjects registrados en este SignedXml
            foreach (DataObject dataObj in this.Signature.ObjectList)
            {
                if (dataObj.Data != null)
                {
                    foreach (XmlNode node in dataObj.Data)
                    {
                        if (node is XmlElement el)
                        {
                            if (el.GetAttribute("Id") == idValue || el.GetAttribute("id") == idValue)
                                return el;

                            var childList = el.SelectNodes($"//*[@id='{idValue}'] | //*[@Id='{idValue}']");
                            if (childList != null && childList.Count > 0)
                                return childList[0] as XmlElement;
                        }
                    }
                }
            }

            return null;
        }
    }

    /// <summary>
    /// Firma el XML con XAdES-BES usando el certificado .p12 del contribuyente.
    /// Revertido al algoritmo original de string-interpolation a petición del usuario.
    /// </summary>
    private Task<string> FirmarXml(string xmlContent, CompanySetting company)
    {
        if (company.ElectronicSignatureFile == null || company.ElectronicSignatureFile.Length == 0)
        {
            throw new InvalidOperationException(
                "Firma electrónica: archivo .p12 no encontrado en la base de datos. " +
                "Sube tu certificado en Ajustes → Facturación Electrónica.");
        }

        var password = company.ElectronicSignaturePassword ?? "";

        // 1. Cargar certificado .p12
        X509Certificate2 cert;
        try
        {
            cert = X509CertificateLoader.LoadPkcs12(
                company.ElectronicSignatureFile,
                password,
                X509KeyStorageFlags.Exportable | X509KeyStorageFlags.PersistKeySet
            );
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"No se pudo cargar el certificado .p12. Verifica la contraseña. Detalle: {ex.Message}");
        }

        // Reemplazar CRLF por LF para normalización segura
        xmlContent = xmlContent.Replace("\r\n", "\n");

        // 2. Preparar documento XML
        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        xmlDoc.LoadXml(xmlContent);

        // 3. Obtener clave privada RSA
        using var rsa = cert.GetRSAPrivateKey()
            ?? throw new InvalidOperationException("El certificado no tiene clave privada RSA.");

        // 4. Calcular digest del certificado (SHA1) para XAdES
        using var sha1 = SHA1.Create();
        var certRawBytes = cert.RawData;
        var certDigestBytes = sha1.ComputeHash(certRawBytes);
        var certDigestB64 = Convert.ToBase64String(certDigestBytes);

        // 5. Construir nodo xades:SignedProperties (requerido por SRI)
        var now = DateTime.UtcNow;
        var signingTime = now.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var signatureId = "Signature" + now.Ticks;
        var signedPropsId = "SignedProperties" + now.Ticks;

        var xadesNs = "http://uri.etsi.org/01903/v1.3.2#";
        var signatureNs = "http://www.w3.org/2000/09/xmldsig#";

        // Crear el bloque XAdES como XML
        var xadesXml = new XmlDocument { PreserveWhitespace = true };
        var xadesRoot = xadesXml.CreateElement("xades", "QualifyingProperties", xadesNs);
        xadesRoot.SetAttribute("Target", "#" + signatureId);
        xadesRoot.SetAttribute("xmlns:xades", xadesNs);

        var signedProps = xadesXml.CreateElement("xades", "SignedProperties", xadesNs);
        signedProps.SetAttribute("Id", signedPropsId);

        var signedSigProps = xadesXml.CreateElement("xades", "SignedSignatureProperties", xadesNs);

        // SigningTime
        var sigTimeNode = xadesXml.CreateElement("xades", "SigningTime", xadesNs);
        sigTimeNode.InnerText = signingTime;
        signedSigProps.AppendChild(sigTimeNode);

        // SigningCertificate
        var signingCert = xadesXml.CreateElement("xades", "SigningCertificate", xadesNs);
        var certNode = xadesXml.CreateElement("xades", "Cert", xadesNs);

        var certDigest = xadesXml.CreateElement("xades", "CertDigest", xadesNs);
        var digestMethod = xadesXml.CreateElement("ds", "DigestMethod", signatureNs);
        digestMethod.SetAttribute("Algorithm", "http://www.w3.org/2000/09/xmldsig#sha1");
        var digestValue = xadesXml.CreateElement("ds", "DigestValue", signatureNs);
        digestValue.InnerText = certDigestB64;
        certDigest.AppendChild(digestMethod);
        certDigest.AppendChild(digestValue);

        var issuerSerial = xadesXml.CreateElement("xades", "IssuerSerial", xadesNs);
        var issuerName = xadesXml.CreateElement("ds", "X509IssuerName", signatureNs);
        
        // Invertir Issuer Name para compatibilidad con Java/SRI
        var issuerParts = cert.Issuer.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
        Array.Reverse(issuerParts);
        var reversedIssuer = string.Join(", ", issuerParts);
        issuerName.InnerText = EscapeXml(reversedIssuer);
        
        var serialNumber = xadesXml.CreateElement("ds", "X509SerialNumber", signatureNs);
        serialNumber.InnerText = BigIntegerFromHex(cert.SerialNumber).ToString();
        
        issuerSerial.AppendChild(issuerName);
        issuerSerial.AppendChild(serialNumber);

        certNode.AppendChild(certDigest);
        certNode.AppendChild(issuerSerial);
        signingCert.AppendChild(certNode);
        signedSigProps.AppendChild(signingCert);
        signedProps.AppendChild(signedSigProps);
        xadesRoot.AppendChild(signedProps);
        xadesXml.AppendChild(xadesRoot);

        // 6. Calcular digest de SignedProperties (C14N → SHA1)
        var c14n = new XmlDsigC14NTransform();
        c14n.LoadInput(xadesXml);
        using var spStream = (System.IO.Stream)c14n.GetOutput(typeof(System.IO.Stream));
        var spDigest = sha1.ComputeHash(spStream);
        var spDigestB64 = Convert.ToBase64String(spDigest);

        // 7. Calcular digest del documento completo (C14N → SHA1)
        var docC14n = new XmlDsigC14NTransform();
        docC14n.LoadInput(xmlDoc);
        using var docStream = (System.IO.Stream)docC14n.GetOutput(typeof(System.IO.Stream));
        var docDigest = sha1.ComputeHash(docStream);
        var docDigestB64 = Convert.ToBase64String(docDigest);

        // 8. Construir SignedInfo (con LF explicitly)
        var signedInfoXml = $"<ds:SignedInfo xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\">\n" +
$"  <ds:CanonicalizationMethod Algorithm=\"http://www.w3.org/TR/2001/REC-xml-c14n-20010315\"/>\n" +
$"  <ds:SignatureMethod Algorithm=\"http://www.w3.org/2000/09/xmldsig#rsa-sha1\"/>\n" +
$"  <ds:Reference Id=\"comprobante-ref-0\" URI=\"#comprobante\">\n" +
$"    <ds:Transforms>\n" +
$"      <ds:Transform Algorithm=\"http://www.w3.org/2000/09/xmldsig#enveloped-signature\"/>\n" +
$"    </ds:Transforms>\n" +
$"    <ds:DigestMethod Algorithm=\"http://www.w3.org/2000/09/xmldsig#sha1\"/>\n" +
$"    <ds:DigestValue>{docDigestB64}</ds:DigestValue>\n" +
$"  </ds:Reference>\n" +
$"  <ds:Reference Type=\"http://uri.etsi.org/01903#SignedProperties\" URI=\"#{signedPropsId}\">\n" +
$"    <ds:DigestMethod Algorithm=\"http://www.w3.org/2000/09/xmldsig#sha1\"/>\n" +
$"    <ds:DigestValue>{spDigestB64}</ds:DigestValue>\n" +
$"  </ds:Reference>\n" +
$"</ds:SignedInfo>";

        // 9. Canonicalizar SignedInfo y firmar con RSA-SHA1
        var siDoc = new XmlDocument { PreserveWhitespace = true };
        siDoc.LoadXml(signedInfoXml);
        var siC14n = new XmlDsigC14NTransform();
        siC14n.LoadInput(siDoc);
        using var siStream = (System.IO.Stream)siC14n.GetOutput(typeof(System.IO.Stream));
        var siBytes = ReadStream(siStream);
        var signatureBytes = rsa.SignData(siBytes, HashAlgorithmName.SHA1, RSASignaturePadding.Pkcs1);
        var signatureValueB64 = Convert.ToBase64String(signatureBytes);

        // 10. Codificar certificado completo en Base64
        var certB64 = Convert.ToBase64String(cert.RawData);

        // 11. Construir nodo ds:Signature completo
        var signatureBlock = $"<ds:Signature xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" Id=\"{signatureId}\">\n" +
$"  {signedInfoXml.Replace("\n", "\n  ")}\n" +
$"  <ds:SignatureValue>{signatureValueB64}</ds:SignatureValue>\n" +
$"  <ds:KeyInfo>\n" +
$"    <ds:X509Data>\n" +
$"      <ds:X509Certificate>{certB64}</ds:X509Certificate>\n" +
$"    </ds:X509Data>\n" +
$"  </ds:KeyInfo>\n" +
$"  <ds:Object>\n" +
$"    <xades:QualifyingProperties xmlns:xades=\"http://uri.etsi.org/01903/v1.3.2#\" Target=\"#{signatureId}\">\n" +
$"      <xades:SignedProperties Id=\"{signedPropsId}\">\n" +
$"        <xades:SignedSignatureProperties>\n" +
$"          <xades:SigningTime>{signingTime}</xades:SigningTime>\n" +
$"          <xades:SigningCertificate>\n" +
$"            <xades:Cert>\n" +
$"              <xades:CertDigest>\n" +
$"                <ds:DigestMethod Algorithm=\"http://www.w3.org/2000/09/xmldsig#sha1\"/>\n" +
$"                <ds:DigestValue>{certDigestB64}</ds:DigestValue>\n" +
$"              </xades:CertDigest>\n" +
$"              <xades:IssuerSerial>\n" +
$"                <ds:X509IssuerName>{EscapeXml(reversedIssuer)}</ds:X509IssuerName>\n" +
$"                <ds:X509SerialNumber>{BigIntegerFromHex(cert.SerialNumber)}</ds:X509SerialNumber>\n" +
$"              </xades:IssuerSerial>\n" +
$"            </xades:Cert>\n" +
$"          </xades:SigningCertificate>\n" +
$"        </xades:SignedSignatureProperties>\n" +
$"      </xades:SignedProperties>\n" +
$"    </xades:QualifyingProperties>\n" +
$"  </ds:Object>\n" +
$"</ds:Signature>";

        // 12. Insertar firma en el documento XML original
        var sigDoc = new XmlDocument { PreserveWhitespace = true };
        sigDoc.LoadXml(signatureBlock);
        var importedSig = xmlDoc.ImportNode(sigDoc.DocumentElement!, true);
        xmlDoc.DocumentElement!.AppendChild(importedSig);

        return Task.FromResult(xmlDoc.OuterXml);
    }

    private static byte[] ReadStream(System.IO.Stream stream)
    {
        using var ms = new System.IO.MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }

    private static System.Numerics.BigInteger BigIntegerFromHex(string? hex)
    {
        if (string.IsNullOrEmpty(hex)) return 0;
        return System.Numerics.BigInteger.Parse("00" + hex,
            System.Globalization.NumberStyles.HexNumber);
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

    private static ElectronicBillingResult Error(string mensaje) => new()
    {
        Success = false,
        Status = "ERROR",
        ErrorMessage = mensaje
    };
}
