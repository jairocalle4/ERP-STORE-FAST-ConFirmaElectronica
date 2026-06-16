namespace ErpStore.Application.DTOs;

public class CompanySettingDto
{
    public string Name { get; set; } = string.Empty;
    public string Ruc { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? LegalMessage { get; set; }
    public string? SriAuth { get; set; }
    public string? Establishment { get; set; }
    public string? PointOfIssue { get; set; }
    public int CurrentSequence { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? SocialReason { get; set; }
    public string? SmtpServer { get; set; }
    public int SmtpPort { get; set; }
    public string? SmtpUser { get; set; }
    public string? SmtpPass { get; set; }
    public string? BrevoApiKey { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? SriEnvironment { get; set; }
    public string? SriEstablishment { get; set; }
    public string? SriPointOfIssue { get; set; }
    public string? TributaryRegime { get; set; }
    public string? ElectronicSignaturePath { get; set; }
    public string? ElectronicSignaturePassword { get; set; }
    public bool ElectronicBillingEnabled { get; set; }
}
