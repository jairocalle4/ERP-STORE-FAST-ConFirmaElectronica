using System.Text.Json.Serialization;

namespace ErpStore.Application.DTOs;

/// <summary>DTOs para la facturación electrónica SRI.</summary>

public record ElectronicBillingResultDto(
    bool Success,
    string? AccessKey,
    string? AuthorizationNumber,
    DateTime? AuthorizationDate,
    string Status,
    string? ErrorMessage
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

public class SriXmlDebugSignResponseDto
{
    public int SaleId { get; set; }
    public string Ambiente { get; set; } = string.Empty;
    [JsonPropertyName("endpointSRI")]
    public SriEndpointPreviewDto EndpointSri { get; set; } = new();
    public string? ClaveAccesoMasked { get; set; }
    public bool IsValid { get; set; }
    public bool IsKeyInfoReferenced { get; set; }
    public bool IsSignedPropertiesReferenced { get; set; }
    public bool HasSignedDataObjectProperties { get; set; }
    public bool HasDataObjectFormat { get; set; }
    public string? CertificateThumbprintMasked { get; set; }
    public string? DiagnosticPath { get; set; }
    public List<string> Warnings { get; set; } = new();
}

public class SriEndpointPreviewDto
{
    public string Recepcion { get; set; } = string.Empty;
    public string Autorizacion { get; set; } = string.Empty;
}
