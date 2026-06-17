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

    public CompanySettingsController(AppDbContext context, ErpStore.Application.Interfaces.IElectronicBillingService billingService)
    {
        _context = context;
        _billingService = billingService;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<CompanySetting>> GetSettings()
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
                CreatedAt = DateTime.UtcNow
            };
            _context.CompanySettings.Add(settings);
            await _context.SaveChangesAsync();
        }

        return settings;
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

        settings.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        
        try {
            await _billingService.SyncConfigurationAsync(settings);
            await _billingService.SyncCertificateAsync(settings);
        } catch (Exception ex) {
            Console.WriteLine($"Error syncing with NestJS: {ex.Message}");
        }

        return Ok(settings);
    }
}
