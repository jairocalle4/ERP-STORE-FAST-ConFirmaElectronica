using ElectronicBilling.Core.Enums;

namespace ElectronicBilling.Core.Entities;

public class EmissionPointSequence
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string TenantId { get; set; }
    public required string Establishment { get; set; }
    public required string EmissionPoint { get; set; }
    public DocumentType DocumentType { get; set; } = DocumentType.Invoice;
    public int CurrentSequence { get; set; } = 1;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ElectronicDocumentAudit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string TenantId { get; set; }
    public Guid DocumentId { get; set; }
    public string? AccessKey { get; set; }
    public ElectronicStatus PreviousStatus { get; set; }
    public ElectronicStatus NewStatus { get; set; }
    public string? Action { get; set; }
    public string? Message { get; set; }
    public string? UserId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
