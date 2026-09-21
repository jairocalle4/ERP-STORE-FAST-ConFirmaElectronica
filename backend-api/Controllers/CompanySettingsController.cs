using ErpStore.Application.DTOs;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ErpStore.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class CompanySettingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ErpStore.Application.Interfaces.IElectronicBillingService _billingService;
    private readonly IConfiguration _configuration;

    public CompanySettingsController(
        AppDbContext context, 
        ErpStore.Application.Interfaces.IElectronicBillingService billingService,
        IConfiguration configuration)
    {
        _context = context;
        _billingService = billingService;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<object>> GetSettings()
    {
        var settings = await _context.CompanySettings.FirstOrDefaultAsync();
        
        if (settings == null)
        {
            // Create default settings if none exist
            settings = new CompanySetting
            {
                Name = "Mi Empresa",
                Ruc = "9999999999001",
                Address = "Dirección Principal",
                CurrentSequence = 1,
                CloudinaryCloudName = _configuration["CloudinarySettings:CloudName"] ?? "ddw9fdcnt",
                CloudinaryApiKey = _configuration["CloudinarySettings:ApiKey"] ?? "123343449494239",
                CloudinaryApiSecret = _configuration["CloudinarySettings:ApiSecret"] ?? "Ywviek0h8q_ecKnEXH06UjW2rtA",
                CreatedAt = DateTime.UtcNow
            };
            _context.CompanySettings.Add(settings);
            await _context.SaveChangesAsync();
        }
        else
        {
            // Si la base de datos no tiene credenciales de Cloudinary aún, poblar con las configuradas por defecto
            bool updated = false;
            if (string.IsNullOrWhiteSpace(settings.CloudinaryCloudName))
            {
                settings.CloudinaryCloudName = _configuration["CloudinarySettings:CloudName"] ?? "ddw9fdcnt";
                updated = true;
            }
            if (string.IsNullOrWhiteSpace(settings.CloudinaryApiKey))
            {
                settings.CloudinaryApiKey = _configuration["CloudinarySettings:ApiKey"] ?? "123343449494239";
                updated = true;
            }
            if (string.IsNullOrWhiteSpace(settings.CloudinaryApiSecret))
            {
                settings.CloudinaryApiSecret = _configuration["CloudinarySettings:ApiSecret"] ?? "Ywviek0h8q_ecKnEXH06UjW2rtA";
                updated = true;
            }
            if (updated)
            {
                await _context.SaveChangesAsync();
            }
        }

        // SEGURIDAD: Proteger credenciales privadas del frontend (nunca exponer API Secret ni API Key)
        bool hasCloudinary = !string.IsNullOrWhiteSpace(settings.CloudinaryApiKey) && !string.IsNullOrWhiteSpace(settings.CloudinaryApiSecret);
        bool hasBrevo = !string.IsNullOrWhiteSpace(settings.BrevoApiKey);
        bool hasSignature = settings.ElectronicSignatureFile != null && settings.ElectronicSignatureFile.Length > 0;

        return Ok(new
        {
            id = settings.Id,
            name = settings.Name,
            ruc = settings.Ruc,
            address = settings.Address,
            phone = settings.Phone,
            email = settings.Email,
            legalMessage = settings.LegalMessage,
            sriAuth = settings.SriAuth,
            establishment = settings.Establishment,
            pointOfIssue = settings.PointOfIssue,
            currentSequence = settings.CurrentSequence,
            expirationDate = settings.ExpirationDate,
            socialReason = settings.SocialReason,
            coverImageUrl = settings.CoverImageUrl,
            logoUrl = settings.LogoUrl,
            sriEnvironment = settings.SriEnvironment,
            sriEstablishment = settings.SriEstablishment,
            sriPointOfIssue = settings.SriPointOfIssue,
            tributaryRegime = settings.TributaryRegime,
            electronicBillingEnabled = settings.ElectronicBillingEnabled,
            softwareProviderRuc = settings.SoftwareProviderRuc,
            ivaRate = settings.IvaRate,

            // Cloudinary: Solo el CloudName público y el indicador seguro de que está configurado
            cloudinaryCloudName = settings.CloudinaryCloudName,
            hasCloudinaryConfigured = hasCloudinary,

            // Brevo
            hasBrevoConfigured = hasBrevo,
            brevoApiKey = settings.BrevoApiKey,

            // Firma
            hasSignature = hasSignature,

            createdAt = settings.CreatedAt,
            updatedAt = settings.UpdatedAt
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateSettings(CompanySettingDto dto)
    {
        var settings = await _context.CompanySettings.FirstOrDefaultAsync();
        
        if (settings == null)
        {
            settings = new CompanySetting { CreatedAt = DateTime.UtcNow };
            _context.CompanySettings.Add(settings);
        }

        settings.Name = dto.Name;
        settings.Ruc = dto.Ruc;
        settings.Address = dto.Address;
        settings.Phone = dto.Phone;
        settings.Email = dto.Email;
        settings.LegalMessage = dto.LegalMessage;
        settings.SriAuth = dto.SriAuth;
        settings.Establishment = dto.Establishment;
        settings.PointOfIssue = dto.PointOfIssue;
        settings.CurrentSequence = dto.CurrentSequence;
        settings.ExpirationDate = dto.ExpirationDate;
        settings.SocialReason = dto.SocialReason;
        settings.SmtpServer = dto.SmtpServer;
        settings.SmtpPort = dto.SmtpPort;
        settings.SmtpUser = dto.SmtpUser;
        settings.SmtpPass = dto.SmtpPass;
        settings.BrevoApiKey = dto.BrevoApiKey;
        settings.CoverImageUrl = dto.CoverImageUrl;
        settings.LogoUrl = dto.LogoUrl;

        // SRI Fields
        settings.SriEnvironment = dto.SriEnvironment;
        settings.SriEstablishment = dto.SriEstablishment;
        settings.SriPointOfIssue = dto.SriPointOfIssue;
        settings.TributaryRegime = dto.TributaryRegime;
        settings.ElectronicSignaturePath = dto.ElectronicSignaturePath;
        settings.ElectronicSignaturePassword = dto.ElectronicSignaturePassword;
        settings.ElectronicBillingEnabled = dto.ElectronicBillingEnabled;

        // Cloudinary: Solo actualizar si se envían valores nuevos reales (no máscaras ni strings vacíos)
        if (!string.IsNullOrWhiteSpace(dto.CloudinaryCloudName))
            settings.CloudinaryCloudName = dto.CloudinaryCloudName.Trim();

        if (!string.IsNullOrWhiteSpace(dto.CloudinaryApiKey) && !dto.CloudinaryApiKey.StartsWith("••"))
            settings.CloudinaryApiKey = dto.CloudinaryApiKey.Trim();
        else if (dto.CloudinaryApiKey == "__CLEAR__")
            settings.CloudinaryApiKey = null;

        if (!string.IsNullOrWhiteSpace(dto.CloudinaryApiSecret) && !dto.CloudinaryApiSecret.StartsWith("••"))
            settings.CloudinaryApiSecret = dto.CloudinaryApiSecret.Trim();
        else if (dto.CloudinaryApiSecret == "__CLEAR__")
            settings.CloudinaryApiSecret = null;

        // Proveedor de Software SRI
        settings.SoftwareProviderRuc = dto.SoftwareProviderRuc;

        settings.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        
        try {
            await _billingService.SyncConfigurationAsync(settings);
            await _billingService.SyncCertificateAsync(settings);
        } catch (Exception ex) {
            Console.WriteLine($"Error syncing with NestJS: {ex.Message}");
        }

        return Ok(new {
            settings.Id,
            settings.Name,
            settings.CloudinaryCloudName,
            hasCloudinaryConfigured = !string.IsNullOrWhiteSpace(settings.CloudinaryApiKey) && !string.IsNullOrWhiteSpace(settings.CloudinaryApiSecret),
            settings.UpdatedAt
        });
    }
}
