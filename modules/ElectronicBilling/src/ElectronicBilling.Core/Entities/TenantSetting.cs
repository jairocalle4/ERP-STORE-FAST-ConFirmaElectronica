using ElectronicBilling.Core.Enums;

namespace ElectronicBilling.Core.Entities;

public class TenantSetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string TenantId { get; set; }
    
    public required string Ruc { get; set; }
    public required string SocialReason { get; set; }
    public string? CommercialName { get; set; }
    public required string MainAddress { get; set; }
    
    public string SriEstablishment { get; set; } = "001";
    public string SriPointOfIssue { get; set; } = "001";
    public int CurrentSequence { get; set; } = 1;
    public SriEnvironment SriEnvironment { get; set; } = SriEnvironment.Test;
    
    public bool IsObligedToKeepAccounts { get; set; } = false;
    public string? RimpeType { get; set; }
    public string? SpecialResolutionNumber { get; set; }
    
    public byte[]? EncryptedSignatureFile { get; set; }
    public string? EncryptedSignaturePassword { get; set; }
    public DateTime? SignatureExpiryDate { get; set; }
    public string? SignatureSubject { get; set; }
    
    public byte[]? LogoBytes { get; set; }
    public string? LogoContentType { get; set; }
    
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string? SmtpUser { get; set; }
    public string? SmtpPassword { get; set; }
    public bool SmtpEnableSsl { get; set; } = true;
    public string? SmtpSenderEmail { get; set; }
    
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
