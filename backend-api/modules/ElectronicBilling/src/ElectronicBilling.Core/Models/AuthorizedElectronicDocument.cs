using ElectronicBilling.Core.Enums;

namespace ElectronicBilling.Core.Models;

public class AuthorizedElectronicDocument
{
    public bool Success { get; set; }
    public ElectronicStatus Status { get; set; }
    public string? AccessKey { get; set; }
    public string? AuthorizationNumber { get; set; }
    public DateTime? AuthorizationDate { get; set; }
    public string? XmlContent { get; set; }
    public string? SignedXmlContent { get; set; }
    public byte[]? PdfRideBytes { get; set; }
    public string? ErrorMessage { get; set; }
    public List<SriMessageInfo> Messages { get; set; } = new();
    public bool EmailSent { get; set; }
    public string? EmailError { get; set; }
}

public class SriMessageInfo
{
    public string? Identifier { get; set; }
    public string? Message { get; set; }
    public string? AdditionalInfo { get; set; }
    public string? Type { get; set; }
}
