using ElectronicBilling.Core.Contracts;

namespace ElectronicBilling.Core.Interfaces;

public interface IElectronicBillingService
{
    Task<Models.AuthorizedElectronicDocument> EmitInvoiceAsync(ElectronicInvoiceRequest request);
    Task<Models.AuthorizedElectronicDocument> RetryEmissionAsync(string tenantId, Guid documentId);
    Task<Models.AuthorizedElectronicDocument?> GetDocumentStatusAsync(string tenantId, string accessKey);
    Task<byte[]> GetRidePdfAsync(string tenantId, string accessKey);
    Task<string> GetDocumentXmlAsync(string tenantId, string accessKey);
    Task<bool> ResendEmailAsync(string tenantId, string accessKey, string targetEmail);
}

public interface ISriXmlSigner
{
    string SignXml(string xmlString, byte[] p12Bytes, string p12Password);
}

public interface ISriXmlSignatureValidator
{
    XmlSignatureValidationResult ValidateSignature(string signedXmlString);
}

public class XmlSignatureValidationResult
{
    public bool IsValid { get; set; }
    public bool DigestValueValid { get; set; }
    public bool SignatureValueValid { get; set; }
    public bool CheckSignatureWithKeyInfo { get; set; }
    public bool CheckSignatureWithCertificate { get; set; }
    public string? SigningCertificateSubject { get; set; }
    public DateTime? SigningCertificateExpiry { get; set; }
    public string? ErrorMessage { get; set; }
}

public interface ISriSoapClient
{
    Task<SriSoapReceptionResult> SendForReceptionAsync(string signedXmlContent, Enums.SriEnvironment environment);
    Task<SriSoapAuthorizationResult> QueryAuthorizationAsync(string accessKey, Enums.SriEnvironment environment);
}

public class SriSoapReceptionResult
{
    public bool Received { get; set; }
    public string Status { get; set; } = "DEVUELTA";
    public List<Models.SriMessageInfo> Messages { get; set; } = new();
}

public class SriSoapAuthorizationResult
{
    public bool Authorized { get; set; }
    public string Status { get; set; } = "NO AUTORIZADO";
    public string? AuthorizationNumber { get; set; }
    public DateTime? AuthorizationDate { get; set; }
    public string? AuthorizedXml { get; set; }
    public List<Models.SriMessageInfo> Messages { get; set; } = new();
}

public interface IRideGenerator
{
    byte[] GenerateRidePdf(Models.AuthorizedElectronicDocument document, Contracts.IssuerData issuer, Contracts.CustomerData customer, List<Contracts.InvoiceLine> lines, List<Contracts.PaymentDetail> payments, byte[]? logoBytes);
}

public interface ISequenceManager
{
    Task<int> GetNextSequenceAsync(string tenantId, string establishment, string emissionPoint, Enums.DocumentType documentType);
}

public interface IEmailNotifier
{
    Task<(bool Success, string? Error)> SendDocumentEmailAsync(Entities.TenantSetting tenant, string toEmail, string subject, string body, string xmlFilename, string xmlContent, byte[] ridePdfBytes);
}

public interface ICertificateManager
{
    (byte[] EncryptedBytes, string EncryptedPassword) ProtectCertificate(byte[] rawP12, string rawPassword);
    (byte[] RawP12, string RawPassword) UnprotectCertificate(byte[] encryptedBytes, string encryptedPassword);
    (bool IsValid, DateTime ExpiryDate, string Subject, string? Error) ValidateP12(byte[] p12Bytes, string password);
}
