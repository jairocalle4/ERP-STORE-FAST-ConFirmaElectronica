using ErpStore.Application.DTOs;

namespace ErpStore.Application.Interfaces;

/// <summary>
/// Firma y valida XML de comprobantes electronicos SRI.
/// </summary>
public interface ISriXmlSigner
{
    Task<SriXmlSignResult> SignXmlAsync(
        string xmlContent,
        byte[] certificateBytes,
        string? certificatePassword,
        CancellationToken cancellationToken = default);

    SriXmlSignatureValidationResult ValidateSignature(string signedXmlContent);
}
