using ErpStore.Application.DTOs;
using ErpStore.Application.Interfaces;
using ErpStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ErpStore.Controllers;

/// <summary>
/// Controller para gestionar la Facturación Electrónica SRI.
/// Endpoints: emitir, descargar XML, descargar RIDE, subir firma .p12, consultar estado.
/// </summary>
[ApiController]
[Route("api/v1/electronic-billing")]
[Authorize]
public class ElectronicBillingController : ControllerBase
{
    private readonly IElectronicBillingService _billingService;
    private readonly AppDbContext _context;
    private readonly ILogger<ElectronicBillingController> _logger;

    public ElectronicBillingController(
        IElectronicBillingService billingService,
        AppDbContext context,
        ILogger<ElectronicBillingController> logger)
    {
        _billingService = billingService;
        _context = context;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────────
    // POST /api/electronic-billing/emit/{saleId}
    // Emite la factura electrónica para una venta existente
    // ──────────────────────────────────────────────────────
    [HttpPost("emit/{saleId:int}")]
    public async Task<ActionResult<ElectronicBillingResultDto>> EmitirFactura(int saleId)
    {
        try
        {
            var resultado = await _billingService.EmitirFactura(saleId);
            var dto = new ElectronicBillingResultDto(
                resultado.Success,
                resultado.AccessKey,
                resultado.AuthorizationNumber,
                resultado.AuthorizationDate,
                resultado.Status,
                resultado.ErrorMessage
            );

            // Devolvemos 200 siempre; el campo Success indica si fue autorizado
            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en EmitirFactura para venta {SaleId}", saleId);
            return BadRequest(new { error = ex.Message });
        }
    }

    // ──────────────────────────────────────────────────────
    // GET /api/electronic-billing/xml/{saleId}
    // Descarga el XML autorizado de una venta
    // ──────────────────────────────────────────────────────
    [HttpGet("xml/{saleId:int}")]
    public async Task<IActionResult> DescargarXml(int saleId)
    {
        var sale = await _context.Sales.FindAsync(saleId);
        if (sale == null || string.IsNullOrEmpty(sale.AccessKey))
            return NotFound("La venta no existe o no tiene XML generado.");

        try
        {
            // Intentar primero obtener el archivo local
            var xmlPath = await _billingService.ObtenerRutaXml(saleId);
            if (!string.IsNullOrEmpty(xmlPath) && System.IO.File.Exists(xmlPath))
            {
                var bytes = await System.IO.File.ReadAllBytesAsync(xmlPath);
                return File(bytes, "application/xml", $"factura_{sale.NoteNumber}.xml");
            }

            // Sino, generar XML al vuelo
            var xml = await _billingService.GenerarXml(saleId);
            var xmlBytes = System.Text.Encoding.UTF8.GetBytes(xml);
            return File(xmlBytes, "application/xml", $"factura_{sale.NoteNumber}.xml");
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    // ──────────────────────────────────────────────────────
    // POST /api/v1/electronic-billing/resend-email/{saleId}
    // Reenvía el correo de la factura electrónica al cliente
    // ──────────────────────────────────────────────────────
    [HttpPost("resend-email/{saleId:int}")]
    public async Task<IActionResult> ResendEmail(int saleId)
    {
        try
        {
            var result = await _billingService.SendInvoiceEmailAsync(saleId);
            return Ok(new { success = result, message = "Correo reenviado exitosamente." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // ──────────────────────────────────────────────────────
    // GET /api/electronic-billing/ride/{saleId}
    // Descarga el PDF RIDE (Representación Impresa)
    // ──────────────────────────────────────────────────────
    [HttpGet("ride/{saleId:int}")]
    public async Task<IActionResult> DescargarRide(int saleId)
    {
        var sale = await _context.Sales.FindAsync(saleId);
        if (sale == null) return NotFound("Venta no encontrada");

        var pdfBytes = await _billingService.GenerarRide(saleId);
        var fileName = $"RIDE_{sale.NoteNumber ?? saleId.ToString()}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    // ──────────────────────────────────────────────────────
    // POST /api/electronic-billing/upload-signature
    // Sube el archivo .p12 de firma electrónica
    // ──────────────────────────────────────────────────────
    [HttpPost("upload-signature")]
    public async Task<IActionResult> SubirFirma([FromForm] SubirFirmaRequest request)
    {
        if (request.File == null || request.File.Length == 0)
            return BadRequest("No se recibió ningún archivo");

        if (!Path.GetExtension(request.File.FileName).Equals(".p12", StringComparison.OrdinalIgnoreCase) &&
            !Path.GetExtension(request.File.FileName).Equals(".pfx", StringComparison.OrdinalIgnoreCase))
            return BadRequest("El archivo debe ser .p12 o .pfx");

        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null) return NotFound("Configuración de empresa no encontrada");

        // Validar temporalmente el certificado y la contraseña
        var tempPath = Path.GetTempFileName();
        try
        {
            using (var stream = new FileStream(tempPath, FileMode.Create))
                await request.File.CopyToAsync(stream);

            byte[] certBytes;
            try
            {
                // Usar X509CertificateLoader de .NET 9
                using var cert = System.Security.Cryptography.X509Certificates.X509CertificateLoader.LoadPkcs12FromFile(
                    tempPath,
                    request.Password ?? string.Empty,
                    System.Security.Cryptography.X509Certificates.X509KeyStorageFlags.Exportable);

                if (DateTime.Now < cert.NotBefore || DateTime.Now > cert.NotAfter)
                {
                    return BadRequest($"La firma electrónica está fuera de su período de validez. Válida desde: {cert.NotBefore} hasta {cert.NotAfter}");
                }
                
                // Si es válido, leer todos los bytes
                certBytes = await System.IO.File.ReadAllBytesAsync(tempPath);
            }
            catch (Exception ex)
            {
                return BadRequest($"La contraseña de la firma es incorrecta o el archivo .p12 está dañado. Detalle: {ex.Message}");
            }

            // Guardar los bytes en la base de datos
            company.ElectronicSignatureFile = certBytes;
            company.ElectronicSignaturePath = null; // Limpiar la ruta antigua si existía
            if (!string.IsNullOrEmpty(request.Password))
                company.ElectronicSignaturePassword = request.Password;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Firma electrónica cargada y verificada exitosamente en la base de datos." });
        }
        finally
        {
            if (System.IO.File.Exists(tempPath))
                System.IO.File.Delete(tempPath);
        }
    }

    // ──────────────────────────────────────────────────────
    // GET /api/electronic-billing/status/{saleId}
    // Consulta el estado de FE de una venta
    // ──────────────────────────────────────────────────────
    [HttpGet("status/{saleId:int}")]
    public async Task<IActionResult> ConsultarEstado(int saleId)
    {
        var sale = await _context.Sales.FindAsync(saleId);
        if (sale == null) return NotFound("Venta no encontrada");

        return Ok(new
        {
            sale.IsElectronic,
            sale.ElectronicStatus,
            sale.AccessKey,
            sale.AuthorizationNumber,
            sale.AuthorizationDate,
            sale.SriErrorMessage,
            sale.NoteNumber
        });
    }

    // ──────────────────────────────────────────────────────
    // GET /api/electronic-billing/settings
    // Devuelve la configuración de FE de la empresa
    // ──────────────────────────────────────────────────────
    [HttpGet("settings")]
    public async Task<ActionResult<CompanyElectronicSettingsDto>> ObtenerConfiguracion()
    {
        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null) return NotFound("Configuración de empresa no encontrada");

        return Ok(new CompanyElectronicSettingsDto
        {
            ElectronicBillingEnabled = company.ElectronicBillingEnabled,
            TributaryRegime = company.TributaryRegime,
            SriEnvironment = company.SriEnvironment,
            CommercialName = company.CommercialName,
            SriEstablishment = company.SriEstablishment,
            SriPointOfIssue = company.SriPointOfIssue,
            IvaRate = company.IvaRate,
            HasSignature = company.ElectronicSignatureFile != null && company.ElectronicSignatureFile.Length > 0
        });
    }

    // ──────────────────────────────────────────────────────
    // PUT /api/electronic-billing/settings
    // Guarda configuración de FE
    // ──────────────────────────────────────────────────────
    [HttpPut("settings")]
    public async Task<IActionResult> GuardarConfiguracion([FromBody] CompanyElectronicSettingsDto dto)
    {
        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        if (company == null) return NotFound("Configuración de empresa no encontrada");

        company.ElectronicBillingEnabled = dto.ElectronicBillingEnabled;
        company.TributaryRegime = dto.TributaryRegime;
        company.SriEnvironment = dto.SriEnvironment;
        company.CommercialName = dto.CommercialName;
        company.SriEstablishment = dto.SriEstablishment;
        company.SriPointOfIssue = dto.SriPointOfIssue;
        company.IvaRate = dto.IvaRate;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Configuración de facturación electrónica guardada" });
    }
}

/// <summary>Modelo del formulario para subir la firma .p12</summary>
public class SubirFirmaRequest
{
    public IFormFile? File { get; set; }
    public string? Password { get; set; }
}
