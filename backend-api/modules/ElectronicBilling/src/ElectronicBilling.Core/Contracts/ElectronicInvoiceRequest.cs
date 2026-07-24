using ElectronicBilling.Core.Enums;

namespace ElectronicBilling.Core.Contracts;

public class ElectronicInvoiceRequest
{
    public required string TenantId { get; set; }
    public string? SourceSystem { get; set; }
    public string? SourceEntityType { get; set; }
    public string? SourceEntityId { get; set; }
    public string? IdempotencyKey { get; set; }

    public required IssuerData Issuer { get; set; }
    public required EstablishmentData Establishment { get; set; }
    public required CustomerData Customer { get; set; }
    public required List<InvoiceLine> Lines { get; set; } = new();
    public required List<PaymentDetail> Payments { get; set; } = new();

    public DateTime EmissionDate { get; set; } = DateTime.UtcNow;
    public string? Sequential { get; set; } // If null, auto-assigned by SequenceManager
    public decimal TipAmount { get; set; } = 0m;
    public string? AdditionalInfo { get; set; }
    public Dictionary<string, string> CustomFields { get; set; } = new();
}

public class IssuerData
{
    public required string Ruc { get; set; }
    public required string SocialReason { get; set; }
    public string? CommercialName { get; set; }
    public required string MainAddress { get; set; }
    public bool IsObligedToKeepAccounts { get; set; } = false;
    public string? RimpeType { get; set; } // e.g. "CONTRIBUYENTE RÉGIMEN RIMPE" or "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE"
    public string? SpecialResolutionNumber { get; set; }
    public SriEnvironment Environment { get; set; } = SriEnvironment.Test;
}

public class EstablishmentData
{
    public required string Code { get; set; } // e.g. "001"
    public required string EmissionPointCode { get; set; } // e.g. "002"
    public required string Address { get; set; }
}

public class CustomerData
{
    public required IdentificationType IdentificationType { get; set; }
    public required string IdentificationNumber { get; set; }
    public required string SocialReason { get; set; }
    public required string Address { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class InvoiceLine
{
    public required string ItemCode { get; set; }
    public string? AuxiliaryCode { get; set; }
    public required string Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Discount { get; set; } = 0m;
    public decimal Subtotal => Math.Round((Quantity * UnitPrice) - Discount, 2, MidpointRounding.AwayFromZero);
    public required List<TaxDetail> Taxes { get; set; } = new();
}

public class TaxDetail
{
    public TaxType TaxType { get; set; } = TaxType.Iva;
    public required string PercentageCode { get; set; } // "4" = 15%, "2" = 12%, "0" = 0%
    public decimal Rate { get; set; } // 15, 12, 0
    public decimal TaxableBase { get; set; }
    public decimal TaxAmount => Math.Round(TaxableBase * (Rate / 100m), 2, MidpointRounding.AwayFromZero);
}

public class PaymentDetail
{
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.SinUtilizacionSistemaFinanciero;
    public decimal Total { get; set; }
    public int TimeLimit { get; set; } = 0;
    public string TimeUnit { get; set; } = "dias";
}
