namespace ErpStore.Application.Interfaces;

/// <summary>
/// Resultado de una operación de facturación electrónica del SRI.
/// </summary>
public class ElectronicBillingResult
{
    public bool Success { get; set; }
    public string? AccessKey { get; set; }
    public string? AuthorizationNumber { get; set; }
    public DateTime? AuthorizationDate { get; set; }
    public string Status { get; set; } = "ERROR";
    public string? ErrorMessage { get; set; }
    public bool EmailSent { get; set; }
    public string? EmailError { get; set; }
}

/// <summary>
/// Servicio de Facturación Electrónica SRI Ecuador.
/// Implementa la generación de XML, firma XAdES-BES, envío SOAP y generación de RIDE (PDF).
/// </summary>
public interface IElectronicBillingService
{
    /// <summary>
    /// Sincroniza la configuración de la empresa con la API de facturación electrónica.
    /// </summary>
    Task SyncConfigurationAsync(ErpStore.Domain.Entities.CompanySetting company);

    /// <summary>
    /// Sincroniza el certificado electrónico (.p12) subiéndolo a la API de facturación.
    /// </summary>
    Task SyncCertificateAsync(ErpStore.Domain.Entities.CompanySetting company);

    /// <summary>
    /// Orquesta el flujo completo: genera XML → firma → envía → consulta autorización → guarda estado.
    /// </summary>
    Task<ElectronicBillingResult> EmitirFactura(int saleId);

    /// <summary>
    /// Genera el XML de la factura siguiendo la Ficha Técnica SRI v2.1.0.
    /// </summary>
    Task<string> GenerarXml(int saleId);

    /// <summary>
    /// Genera el PDF RIDE (Representación Impresa del Documento Electrónico).
    /// </summary>
    Task<byte[]> GenerarRide(int saleId);

    /// <summary>
    /// Devuelve la ruta del XML autorizado guardado localmente.
    /// </summary>
    Task<string?> ObtenerRutaXml(int saleId);

    /// <summary>
    /// Reenvía el correo de la factura electrónica al cliente (incluyendo el XML adjunto).
    /// </summary>
    Task<bool> SendInvoiceEmailAsync(int saleId);
}
