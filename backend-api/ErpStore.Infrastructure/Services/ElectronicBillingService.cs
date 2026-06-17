using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using ErpStore.Application.Interfaces;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ErpStore.Infrastructure.Services;

public class ElectronicBillingService : IElectronicBillingService
{
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ElectronicBillingService> _logger;
    private readonly IEmailService _emailService;

    private string? _cachedJwtToken;
    private DateTime _tokenExpiration;

    public ElectronicBillingService(
        AppDbContext context,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<ElectronicBillingService> logger,
        IEmailService emailService)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        _emailService = emailService;
    }

    private async Task<string> GetAuthTokenAsync()
    {
        if (!string.IsNullOrEmpty(_cachedJwtToken) && DateTime.UtcNow < _tokenExpiration)
        {
            return _cachedJwtToken;
        }

        var baseUrl = _configuration["SriApiSettings:BaseUrl"];
        var email = _configuration["SriApiSettings:AuthEmail"];
        var password = _configuration["SriApiSettings:AuthPassword"];

        using var client = _httpClientFactory.CreateClient();
        var content = new StringContent(
            JsonSerializer.Serialize(new { email, password }),
            Encoding.UTF8,
            "application/json"
        );

        var response = await client.PostAsync($"{baseUrl}/auth/login", content);
        
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            throw new Exception($"Error autenticando con la API SRI: {err}");
        }

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        
        if (doc.RootElement.TryGetProperty("success", out var successProp) && !successProp.GetBoolean())
        {
            var error = doc.RootElement.TryGetProperty("error", out var errProp) ? errProp.GetString() : "Error desconocido";
            throw new Exception($"Error autenticando con la API SRI: {error}");
        }

        _cachedJwtToken = doc.RootElement.GetProperty("accessToken").GetString()!;
        // Token typically valid for 1h, cache for 55m
        _tokenExpiration = DateTime.UtcNow.AddMinutes(55);

        return _cachedJwtToken;
    }

    public async Task SyncConfigurationAsync(ErpStore.Domain.Entities.CompanySetting company)
    {
        if (!company.ElectronicBillingEnabled) return;
        if (string.IsNullOrEmpty(company.Ruc)) return;

        var token = await GetAuthTokenAsync();
        var baseUrl = _configuration["SriApiSettings:BaseUrl"];
        using var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // 1. Obtener Emisores
        var emisoresResponse = await client.GetAsync($"{baseUrl}/emisores");
        emisoresResponse.EnsureSuccessStatusCode();
        var emisoresJson = await emisoresResponse.Content.ReadAsStringAsync();
        using var emisoresDoc = JsonDocument.Parse(emisoresJson);
        
        string? emisorId = null;
        foreach (var emisor in emisoresDoc.RootElement.EnumerateArray())
        {
            if (emisor.GetProperty("ruc").GetString() == company.Ruc)
            {
                emisorId = emisor.GetProperty("id").GetString();
                break;
            }
        }

        var emisorPayload = new
        {
            ruc = company.Ruc,
            razonSocial = string.IsNullOrEmpty(company.SocialReason) ? company.Name : company.SocialReason,
            nombreComercial = company.Name,
            direccionMatriz = company.Address,
            obligadoContabilidad = false,
            contribuyenteRimpe = company.TributaryRegime?.Contains("RIMPE") ?? true,
            ambiente = company.SriEnvironment ?? "1",
            estado = "ACTIVO"
        };

        if (emisorId == null)
        {
            // Create Emisor
            var createResponse = await client.PostAsync($"{baseUrl}/emisores",
                new StringContent(JsonSerializer.Serialize(emisorPayload), Encoding.UTF8, "application/json"));
            createResponse.EnsureSuccessStatusCode();
            var createJson = await createResponse.Content.ReadAsStringAsync();
            using var createDoc = JsonDocument.Parse(createJson);
            emisorId = createDoc.RootElement.GetProperty("id").GetString();
        }
        else
        {
            // Update Emisor
            var updateResponse = await client.PutAsync($"{baseUrl}/emisores/{emisorId}",
                new StringContent(JsonSerializer.Serialize(emisorPayload), Encoding.UTF8, "application/json"));
            updateResponse.EnsureSuccessStatusCode();
        }

        // 2. Punto de Emision
        if (!string.IsNullOrEmpty(company.SriEstablishment) && !string.IsNullOrEmpty(company.SriPointOfIssue))
        {
            // We just let the NestJS API auto-create PuntoEmision if it doesn't exist, OR we can explicitly create it.
            // Wait, FacturaService in NestJS auto-creates PuntoEmision? No, it throws an error if we use Auto-Sequential!
            // But if we pass `secuencial` explicitly (which we do), FacturaService bypasses PuntoEmision existence check!
            // Wait, no. Look at FacturaService: if we bypass `secuencial` check, it still uses `puntoEmisionInfo.punto_emision_id` later!
            // If `puntoEmisionInfo` is null, `puntoEmisionInfo.punto_emision_id` throws a TypeError!
            // Let's create the PuntoEmision!
            var pePayload = new
            {
                establecimiento = company.SriEstablishment.PadLeft(3, '0'),
                puntoEmision = company.SriPointOfIssue.PadLeft(3, '0'),
                direccionEstablecimiento = company.Address,
                descripcion = "Punto de Emisión ERP"
            };

            // First try to GET it by looking at /emisores/{emisorId} ? No, /puntos-emision/emisor/{emisorId}
            var peResponse = await client.GetAsync($"{baseUrl}/puntos-emision/emisor/{emisorId}");
            string? puntoEmisionId = null;
            if (peResponse.IsSuccessStatusCode)
            {
                var peJson = await peResponse.Content.ReadAsStringAsync();
                using var peDoc = JsonDocument.Parse(peJson);
                foreach (var pe in peDoc.RootElement.EnumerateArray())
                {
                    if (pe.GetProperty("establecimiento").GetString() == pePayload.establecimiento &&
                        pe.GetProperty("puntoEmision").GetString() == pePayload.puntoEmision)
                    {
                        puntoEmisionId = pe.GetProperty("id").GetString();
                        break;
                    }
                }
            }

            if (puntoEmisionId == null)
            {
                var createPeResponse = await client.PostAsync($"{baseUrl}/puntos-emision/emisor/{emisorId}",
                    new StringContent(JsonSerializer.Serialize(pePayload), Encoding.UTF8, "application/json"));
                if (!createPeResponse.IsSuccessStatusCode)
                {
                    var err = await createPeResponse.Content.ReadAsStringAsync();
                    Console.WriteLine($"Error creating PuntoEmision: {err}");
                }
            }
        }
    }

    public async Task SyncCertificateAsync(ErpStore.Domain.Entities.CompanySetting company)
    {
        if (company.ElectronicSignatureFile == null || company.ElectronicSignatureFile.Length == 0)
            return; // No certificate to sync
            
        if (string.IsNullOrEmpty(company.Ruc))
            return; // Need RUC to sync certificate

        var token = await GetAuthTokenAsync();
        if (string.IsNullOrEmpty(token)) return;

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var baseUrl = _configuration["SriApiSettings:BaseUrl"];
        var endpoint = $"{baseUrl}/certificates/upload-cert";

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(company.Ruc), "ruc");
        content.Add(new StringContent(company.ElectronicSignaturePassword ?? ""), "password");

        var fileContent = new ByteArrayContent(company.ElectronicSignatureFile);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/x-pkcs12");
        content.Add(fileContent, "cert", "certificado.p12");

        var response = await client.PostAsync(endpoint, content);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorJson = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"Error uploading certificate to API: {errorJson}");
        }
    }

    public async Task<ElectronicBillingResult> EmitirFactura(int saleId)
    {
        var sale = await _context.Sales
            .Include(s => s.SaleDetails)
            .ThenInclude(sd => sd.Product)
            .Include(s => s.Client)
            .Include(s => s.Employee)
            .FirstOrDefaultAsync(s => s.Id == saleId);

        if (sale == null) return Error("Venta no encontrada");

        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null) return Error("Configuración de empresa no encontrada");

        if (!company.ElectronicBillingEnabled)
            return Error("La facturación electrónica no está habilitada");

        try
        {
            if (company.ElectronicSignatureFile != null)
            {
                var certsDir = @"C:\Users\Admin\Desktop\JAIRO\PROYECTOS\certs";
                if (!System.IO.Directory.Exists(certsDir)) System.IO.Directory.CreateDirectory(certsDir);
                Console.WriteLine($"[CERT_PWD] {company.ElectronicSignaturePassword}");
            }

            // 1. Asignar el número de factura si aún no tiene el formato SRI
            if (string.IsNullOrEmpty(sale.NoteNumber) || sale.NoteNumber.StartsWith("V-"))
            {
                var seq = company.CurrentSequence;
                company.CurrentSequence++;
                
                var estab = (company.SriEstablishment ?? "001").PadLeft(3, '0');
                var pto = (company.SriPointOfIssue ?? "001").PadLeft(3, '0');
                sale.NoteNumber = $"{estab}-{pto}-{seq:D9}";
                sale.IsElectronic = true;
                
                await _context.SaveChangesAsync();
            }

            var token = await GetAuthTokenAsync();
            var baseUrl = _configuration["SriApiSettings:BaseUrl"];

            // 2. Extraer el secuencial de los 9 dígitos
            string secuencialPayload = sale.NoteNumber.Contains("-") 
                ? sale.NoteNumber.Split('-')[2] 
                : "000000001";

            // Construir JSON payload
            var payload = new
            {
                ambiente = company.SriEnvironment ?? "1",
                secuencial = secuencialPayload,
                fechaEmision = sale.Date.ToString("dd/MM/yyyy"),
                emisor = new
                {
                    ruc = company.Ruc?.Length == 10 ? company.Ruc + "001" : company.Ruc,
                    razonSocial = company.SocialReason ?? company.Name,
                    nombreComercial = company.CommercialName ?? company.Name,
                    dirMatriz = company.Address,
                    dirEstablecimiento = company.Address,
                    establecimiento = company.SriEstablishment ?? "001",
                    puntoEmision = company.SriPointOfIssue ?? "001",
                    obligadoContabilidad = "NO",
                    contribuyenteRimpe = company.TributaryRegime == "RIMPE_NEGOCIO_POPULAR" 
                        ? "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE" 
                        : company.TributaryRegime == "RIMPE_EMPRENDEDOR"
                            ? "CONTRIBUYENTE RÉGIMEN RIMPE"
                            : null
                },
                comprador = new
                {
                    tipoIdentificacion = (sale.Client?.CedulaRuc == "9999999999" || sale.Client?.CedulaRuc == "9999999999999" || sale.Client == null) ? "07" : 
                        (sale.Client?.IdentificationType == "RUC" ? "04" : 
                        (sale.Client?.IdentificationType == "PASAPORTE" ? "06" : "05")),
                    identificacion = (sale.Client == null || sale.Client.CedulaRuc == "9999999999" || sale.Client.CedulaRuc == "9999999999999") ? "9999999999999" : sale.Client.CedulaRuc,
                    razonSocial = sale.Client?.Name ?? "Consumidor Final",
                    direccion = sale.Client?.Address ?? "Ecuador",
                    email = sale.Client?.Email ?? "notiene@correo.com"
                },
                detalles = sale.SaleDetails.Select(d => new
                {
                    codigoPrincipal = d.ProductId.ToString(),
                    descripcion = d.Product?.Name ?? "Producto",
                    cantidad = d.Quantity,
                    precioUnitario = d.UnitPrice,
                    descuento = 0,
                    impuestos = new[]
                    {
                        new
                        {
                            codigo = "2", // IVA
                            codigoPorcentaje = company.IvaRate == 15 ? "4" : (company.IvaRate == 12 ? "2" : "0"), // Asumimos 4=15%, 2=12%, 0=0%
                            tarifa = company.IvaRate,
                            baseImponible = d.Subtotal,
                            valor = Math.Round(d.Subtotal * (company.IvaRate / 100), 2)
                        }
                    }
                }).ToArray(),
                pagos = new[]
                {
                    new
                    {
                        formaPago = "01", // Sin utilización del sistema financiero
                        total = sale.Total + sale.SaleDetails.Sum(d => Math.Round(d.Subtotal * (company.IvaRate / 100), 2)),
                        plazo = 0,
                        unidadTiempo = "dias"
                    }
                }
            };

            using var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            
            var jsonPayload = JsonSerializer.Serialize(payload);
            Console.WriteLine($"[SRI-PAYLOAD] {jsonPayload}");

            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{baseUrl}/sri/emitir/factura", content);
            var jsonResponse = await response.Content.ReadAsStringAsync();
            Console.WriteLine("NESTJS RESPONSE: " + jsonResponse);
            using var doc = JsonDocument.Parse(jsonResponse);
            
            // Check if API reported success
            bool isSuccess = false;
            if (doc.RootElement.TryGetProperty("success", out var successProp))
            {
                isSuccess = successProp.GetBoolean();
            }

            if (!isSuccess)
            {
                string errMsg = "Error del SRI";
                if (doc.RootElement.TryGetProperty("mensajes", out var mensajesProp) && mensajesProp.GetArrayLength() > 0)
                {
                    var firstMsg = mensajesProp[0];
                    if (firstMsg.TryGetProperty("informacionAdicional", out var infoAdicional))
                    {
                        errMsg = infoAdicional.GetString() ?? errMsg;
                    }
                    else if (firstMsg.TryGetProperty("mensaje", out var msgTexto))
                    {
                        errMsg = msgTexto.GetString() ?? errMsg;
                    }
                }
                else if (doc.RootElement.TryGetProperty("message", out var msgProp))
                {
                    if (msgProp.ValueKind == JsonValueKind.Array && msgProp.GetArrayLength() > 0)
                    {
                        errMsg = msgProp[0].GetString() ?? errMsg;
                    }
                    else if (msgProp.ValueKind == JsonValueKind.String)
                    {
                        errMsg = msgProp.GetString() ?? errMsg;
                    }
                }
                else if (doc.RootElement.TryGetProperty("error", out var errorProp))
                {
                    errMsg = errorProp.GetString() ?? errMsg;
                }

                sale.ElectronicStatus = "ERROR";
                sale.IsElectronic = true;
                sale.SriErrorMessage = errMsg;
                await _context.SaveChangesAsync();

                return new ElectronicBillingResult
                {
                    Success = false,
                    Status = "ERROR",
                    ErrorMessage = errMsg
                };
            }

            // Exito
            var accessKey = doc.RootElement.TryGetProperty("claveAcceso", out var claveProp) ? claveProp.GetString() : null;
            var authNumber = doc.RootElement.TryGetProperty("numeroAutorizacion", out var authProp) ? authProp.GetString() : null;
            
            sale.AccessKey = accessKey;
            sale.AuthorizationNumber = authNumber;
            sale.AuthorizationDate = DateTime.UtcNow;
            sale.ElectronicStatus = "AUTORIZADO";
            sale.IsElectronic = true;
            sale.SriErrorMessage = null;
            
            await _context.SaveChangesAsync();

            // Enviar correo automático
            await TrySendInvoiceEmailAsync(sale, company);

            return new ElectronicBillingResult
            {
                Success = true,
                Status = "AUTORIZADO",
                AccessKey = accessKey,
                AuthorizationNumber = authNumber,
                AuthorizationDate = sale.AuthorizationDate
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error comunicándose con API SRI externa");
            sale.ElectronicStatus = "ERROR";
            sale.SriErrorMessage = ex.Message;
            await _context.SaveChangesAsync();
            return Error(ex.Message);
        }
    }

    private async Task TrySendInvoiceEmailAsync(Sale sale, CompanySetting company)
    {
        try
        {
            if (sale.Client == null) return;
            var email = sale.Client.Email?.Trim();
            if (string.IsNullOrEmpty(email) || email.Equals("consumidor final", StringComparison.OrdinalIgnoreCase) || email.Contains("notiene"))
                return; // No se envía a consumidor final o correos inválidos

            string xmlContent = "";
            try { xmlContent = await GenerarXml(sale.Id); } catch { /* Ignore if XML fetch fails initially */ }

            var attachments = new List<(string, byte[], string)>();
            if (!string.IsNullOrEmpty(xmlContent))
            {
                attachments.Add(($"Factura_{sale.NoteNumber ?? sale.Id.ToString()}.xml", Encoding.UTF8.GetBytes(xmlContent), "application/xml"));
            }
            
            try
            {
                var pdfBytes = ErpStore.Infrastructure.Services.Pdf.RidePdfGenerator.Generate(sale, company);
                attachments.Add(($"RIDE_{sale.NoteNumber ?? sale.Id.ToString()}.pdf", pdfBytes, "application/pdf"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo generar el PDF adjunto con QuestPDF.");
            }

            string body = $@"
                <div style='font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;'>
                    <div style='background:#4f46e5;color:white;padding:30px;text-align:center;'>
                        <h2 style='margin:0;'>Comprobante Electrónico</h2>
                        <p style='margin:5px 0 0;'>{company.Name}</p>
                    </div>
                    <div style='padding:30px;background:white;'>
                        <p>Hola <b>{sale.Client.Name}</b>,</p>
                        <p>Le informamos que su comprobante electrónico ha sido emitido exitosamente.</p>
                        <table style='width:100%;border-collapse:collapse;margin:20px 0;'>
                            <tr><td style='padding:8px;border:1px solid #e2e8f0;'><b>Factura Nº:</b></td><td style='padding:8px;border:1px solid #e2e8f0;'>{sale.NoteNumber}</td></tr>
                            <tr><td style='padding:8px;border:1px solid #e2e8f0;'><b>Total:</b></td><td style='padding:8px;border:1px solid #e2e8f0;'>${sale.Total:F2}</td></tr>
                            <tr><td style='padding:8px;border:1px solid #e2e8f0;'><b>Clave de Acceso:</b></td><td style='padding:8px;border:1px solid #e2e8f0;font-size:12px;word-break:break-all;'>{sale.AccessKey}</td></tr>
                        </table>
                        <p>Puede consultar y descargar el documento ingresando la Clave de Acceso en el portal web del SRI.</p>
                        <p>Se adjunta el archivo XML autorizado.</p>
                    </div>
                </div>";

            await _emailService.SendEmailAsync(email, $"Factura Electrónica {sale.NoteNumber} - {company.Name}", body, attachments);
            _logger.LogInformation($"Correo enviado exitosamente a {email} para la factura {sale.Id}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error al intentar enviar el correo de la factura {sale.Id}");
        }
    }

    public async Task<bool> SendInvoiceEmailAsync(int saleId)
    {
        var sale = await _context.Sales
            .Include(s => s.Client)
            .FirstOrDefaultAsync(s => s.Id == saleId);
            
        if (sale == null || string.IsNullOrEmpty(sale.AccessKey))
            throw new Exception("Venta no encontrada o no tiene factura electrónica generada.");

        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null)
            throw new Exception("No hay configuración de empresa.");

        if (sale.Client == null || string.IsNullOrEmpty(sale.Client.Email))
            throw new Exception("El cliente no tiene un correo electrónico registrado.");

        await TrySendInvoiceEmailAsync(sale, company);
        return true;
    }

    public async Task<string> GenerarXml(int saleId)
    {
        var sale = await _context.Sales.FindAsync(saleId);
        if (sale == null || string.IsNullOrEmpty(sale.AccessKey))
            throw new Exception("Venta no encontrada o no tiene clave de acceso");

        var token = await GetAuthTokenAsync();
        var baseUrl = _configuration["SriApiSettings:BaseUrl"];

        using var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        var response = await client.GetAsync($"{baseUrl}/sri/comprobantes/{sale.AccessKey}/xml");
        
        if (!response.IsSuccessStatusCode)
        {
            throw new Exception("No se pudo descargar el XML de la API externa");
        }

        return await response.Content.ReadAsStringAsync();
    }

    public async Task<byte[]> GenerarRide(int saleId)
    {
        var sale = await _context.Sales
            .Include(s => s.Client)
            .Include(s => s.SaleDetails)
            .ThenInclude(d => d.Product)
            .FirstOrDefaultAsync(s => s.Id == saleId);
            
        if (sale == null || string.IsNullOrEmpty(sale.AccessKey))
            throw new Exception("Venta no encontrada o no tiene clave de acceso");

        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null)
            throw new Exception("Configuración de empresa no encontrada");

        try
        {
            return ErpStore.Infrastructure.Services.Pdf.RidePdfGenerator.Generate(sale, company);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando PDF con QuestPDF");
            throw new Exception("Error al generar el RIDE en PDF: " + ex.Message);
        }
    }

    public async Task<string?> ObtenerRutaXml(int saleId)
    {
        var sale = await _context.Sales.FindAsync(saleId);
        return sale?.XmlPath;
    }

    private ElectronicBillingResult Error(string message)
    {
        return new ElectronicBillingResult
        {
            Success = false,
            Status = "ERROR",
            ErrorMessage = message
        };
    }
}
