using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Entities;
using ElectronicBilling.Core.Interfaces;
using ElectronicBilling.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ElectronicBilling.Api.Controllers;

[ApiController]
[Route("api/v1/electronic-billing-module")]
public class ElectronicBillingModuleController : ControllerBase
{
    private readonly IElectronicBillingService _billingService;
    private readonly ElectronicBillingDbContext _dbContext;
    private readonly ICertificateManager _certManager;

    public ElectronicBillingModuleController(
        IElectronicBillingService billingService,
        ElectronicBillingDbContext dbContext,
        ICertificateManager certManager)
    {
        _billingService = billingService;
        _dbContext = dbContext;
        _certManager = certManager;
    }

    [HttpPost("emit-invoice")]
    public async Task<IActionResult> EmitInvoice([FromBody] ElectronicInvoiceRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _billingService.EmitInvoiceAsync(request);
        if (result.Success) return Ok(result);
        return BadRequest(result);
    }

    [HttpGet("document/{accessKey}")]
    public async Task<IActionResult> GetDocumentStatus([FromQuery] string tenantId, [FromRoute] string accessKey)
    {
        if (string.IsNullOrEmpty(tenantId)) return BadRequest("TenantId es requerido.");

        var doc = await _billingService.GetDocumentStatusAsync(tenantId, accessKey);
        if (doc == null) return NotFound("Documento electrónico no encontrado.");
        return Ok(doc);
    }

    [HttpGet("document/{accessKey}/xml")]
    public async Task<IActionResult> GetDocumentXml([FromQuery] string tenantId, [FromRoute] string accessKey)
    {
        if (string.IsNullOrEmpty(tenantId)) return BadRequest("TenantId es requerido.");

        var xml = await _billingService.GetDocumentXmlAsync(tenantId, accessKey);
        if (string.IsNullOrEmpty(xml)) return NotFound("XML no encontrado.");
        return File(System.Text.Encoding.UTF8.GetBytes(xml), "application/xml", $"Factura_{accessKey}.xml");
    }

    [HttpGet("document/{accessKey}/ride")]
    public async Task<IActionResult> GetDocumentRidePdf([FromQuery] string tenantId, [FromRoute] string accessKey)
    {
        if (string.IsNullOrEmpty(tenantId)) return BadRequest("TenantId es requerido.");

        try
        {
            var pdfBytes = await _billingService.GetRidePdfAsync(tenantId, accessKey);
            return File(pdfBytes, "application/pdf", $"RIDE_{accessKey}.pdf");
        }
        catch (Exception ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("document/{accessKey}/resend-email")]
    public async Task<IActionResult> ResendEmail([FromQuery] string tenantId, [FromRoute] string accessKey, [FromBody] ResendEmailRequest request)
    {
        if (string.IsNullOrEmpty(tenantId) || string.IsNullOrEmpty(request.Email)) return BadRequest("TenantId y Email son requeridos.");

        var success = await _billingService.ResendEmailAsync(tenantId, accessKey, request.Email);
        if (success) return Ok(new { message = "Correo reenviado exitosamente." });
        return BadRequest(new { message = "No se pudo reenviar el correo." });
    }

    [HttpPost("tenant-settings")]
    public async Task<IActionResult> SaveTenantSettings([FromForm] SaveTenantSettingsRequest request)
    {
        if (string.IsNullOrEmpty(request.TenantId) || string.IsNullOrEmpty(request.Ruc))
        {
            return BadRequest("TenantId y RUC son requeridos.");
        }

        var setting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(t => t.TenantId == request.TenantId);

        if (setting == null)
        {
            setting = new TenantSetting
            {
                TenantId = request.TenantId,
                Ruc = request.Ruc,
                SocialReason = request.SocialReason,
                MainAddress = request.MainAddress
            };
            _dbContext.TenantSettings.Add(setting);
        }

        setting.Ruc = request.Ruc;
        setting.SocialReason = request.SocialReason;
        setting.CommercialName = request.CommercialName;
        setting.MainAddress = request.MainAddress;
        setting.SriEstablishment = request.SriEstablishment ?? "001";
        setting.SriPointOfIssue = request.SriPointOfIssue ?? "001";
        setting.SriEnvironment = request.SriEnvironment;
        setting.IsObligedToKeepAccounts = request.IsObligedToKeepAccounts;
        setting.RimpeType = request.RimpeType;

        if (request.SignatureFile != null && request.SignatureFile.Length > 0 && !string.IsNullOrEmpty(request.SignaturePassword))
        {
            using var ms = new MemoryStream();
            await request.SignatureFile.CopyToAsync(ms);
            var rawP12 = ms.ToArray();

            var validation = _certManager.ValidateP12(rawP12, request.SignaturePassword);
            if (!validation.IsValid)
            {
                return BadRequest($"Firma .p12 no válida: {validation.Error}");
            }

            var (encBytes, encPwd) = _certManager.ProtectCertificate(rawP12, request.SignaturePassword);
            setting.EncryptedSignatureFile = encBytes;
            setting.EncryptedSignaturePassword = encPwd;
            setting.SignatureExpiryDate = validation.ExpiryDate;
            setting.SignatureSubject = validation.Subject;
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Configuración del establecimiento guardada exitosamente." });
    }
}

public class ResendEmailRequest
{
    public required string Email { get; set; }
}

public class SaveTenantSettingsRequest
{
    public required string TenantId { get; set; }
    public required string Ruc { get; set; }
    public required string SocialReason { get; set; }
    public string? CommercialName { get; set; }
    public required string MainAddress { get; set; }
    public string SriEstablishment { get; set; } = "001";
    public string SriPointOfIssue { get; set; } = "001";
    public Core.Enums.SriEnvironment SriEnvironment { get; set; } = Core.Enums.SriEnvironment.Test;
    public bool IsObligedToKeepAccounts { get; set; } = false;
    public string? RimpeType { get; set; }
    public Microsoft.AspNetCore.Http.IFormFile? SignatureFile { get; set; }
    public string? SignaturePassword { get; set; }
}
