using ErpStore.Domain.Common;

namespace ErpStore.Domain.Entities;

public class CompanySetting : BaseEntity
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

    // === Facturación Electrónica SRI ===
    /// <summary>Habilita/deshabilita la facturación electrónica en el sistema.</summary>
    public bool ElectronicBillingEnabled { get; set; } = false;

    /// <summary>Régimen tributario: RIMPE_NEGOCIO_POPULAR | RIMPE_EMPRENDEDOR | GENERAL</summary>
    public string? TributaryRegime { get; set; } = "RIMPE_NEGOCIO_POPULAR";

    /// <summary>Ambiente SRI: '1' = Pruebas, '2' = Producción</summary>
    public string? SriEnvironment { get; set; } = "1";

    /// <summary>Nombre comercial del negocio (aparece en el RIDE).</summary>
    public string? CommercialName { get; set; }

    /// <summary>Código de establecimiento SRI (ej. '001').</summary>
    public string? SriEstablishment { get; set; } = "001";

    /// <summary>Punto de emisión SRI (ej. '001').</summary>
    public string? SriPointOfIssue { get; set; } = "001";

    /// <summary>Ruta interna del archivo .p12 de firma electrónica (obsoleto, se usa ElectronicSignatureFile).</summary>
    public string? ElectronicSignaturePath { get; set; }

    /// <summary>Contenido binario del archivo .p12 de firma electrónica.</summary>
    public byte[]? ElectronicSignatureFile { get; set; }

    /// <summary>Contraseña del archivo .p12 (almacenada en texto; en producción usar cifrado).</summary>
    public string? ElectronicSignaturePassword { get; set; }

    /// <summary>
    /// Tasa de IVA configurada por el usuario (ej. 15.00 = 15%). 
    /// Usada para calcular impuestos en facturas electrónicas.
    /// </summary>
    public decimal IvaRate { get; set; } = 15.00m;

    // SMTP Configuration for Alerts
    public string? SmtpServer { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string? SmtpUser { get; set; }
    public string? SmtpPass { get; set; }

    // Brevo (Sendinblue) API — alternative to SMTP when ISP blocks port 587/465
    public string? BrevoApiKey { get; set; }

    public DateTime? LastStockAlertDate { get; set; }

    // SEO & Social Media
    public string? CoverImageUrl { get; set; }
}
