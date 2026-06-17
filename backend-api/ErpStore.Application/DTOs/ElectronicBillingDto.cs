namespace ErpStore.Application.DTOs;

/// <summary>DTOs para la facturación electrónica SRI.</summary>

public record ElectronicBillingResultDto(
    bool Success,
    string? AccessKey,
    string? AuthorizationNumber,
    DateTime? AuthorizationDate,
    string Status,
    string? ErrorMessage,
    bool EmailSent = false,
    string? EmailError = null
);

public record EmitirFacturaRequest(int SaleId);

public class CompanyElectronicSettingsDto
{
    public bool ElectronicBillingEnabled { get; set; }
    public string? TributaryRegime { get; set; }
    public string? SriEnvironment { get; set; }
    public string? CommercialName { get; set; }
    public string? SriEstablishment { get; set; }
    public string? SriPointOfIssue { get; set; }
    /// <summary>IVA en porcentaje (ej. 15.00 = 15%)</summary>
    public decimal IvaRate { get; set; }
    /// <summary>Indica si ya hay una firma .p12 configurada (no devuelve la ruta por seguridad).</summary>
    public bool HasSignature { get; set; }
}
