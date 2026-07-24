using ElectronicBilling.Core.Enums;

namespace ElectronicBilling.Core.Entities;

public class ElectronicDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string TenantId { get; set; }
    
    public DocumentType DocumentType { get; set; } = DocumentType.Invoice;
    public required string AccessKey { get; set; }
    public required string Establishment { get; set; }
    public required string EmissionPoint { get; set; }
    public required string Sequential { get; set; }
    public required string NoteNumber { get; set; } // "001-002-000000009"
    
    public DateTime EmissionDate { get; set; }
    public string? AuthorizationNumber { get; set; }
    public DateTime? AuthorizationDate { get; set; }
    
    public ElectronicStatus Status { get; set; } = ElectronicStatus.Draft;
    public string? ErrorMessage { get; set; }
    
    public string? XmlContent { get; set; }
    public string? SignedXmlContent { get; set; }
    public string? RidePdfPath { get; set; }
    
    public string? SourceSystem { get; set; }
    public string? SourceEntityType { get; set; }
    public string? SourceEntityId { get; set; }
    public string? IdempotencyKey { get; set; }
    
    public required string CustomerCedulaRuc { get; set; }
    public required string CustomerName { get; set; }
    public string? CustomerEmail { get; set; }
    
    public decimal SubtotalWithoutTax { get; set; }
    public decimal SubtotalWithTax { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalAmount { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
