namespace ErpStore.Application.DTOs;

public class SriXmlSignResult
{
    public bool Success { get; set; }
    public string? SignedXml { get; set; }
    public string? ErrorMessage { get; set; }
    public string? SignatureId { get; set; }
    public string? KeyInfoId { get; set; }
    public string? SignedPropertiesId { get; set; }
    public string? ObjectId { get; set; }
    public string? CertificateThumbprintMasked { get; set; }
    public string SignatureMethod { get; set; } = string.Empty;
    public string DigestMethod { get; set; } = string.Empty;
    public bool UsesSha1 { get; set; }
    public SriXmlSignatureValidationResult? Validation { get; set; }
}

public class SriXmlSignatureValidationResult
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public bool? CheckSignatureWithKeyInfo { get; set; }
    public bool? CheckSignatureWithCertificate { get; set; }
    public string? CheckSignatureWithCertificateError { get; set; }
    public bool? SignatureValueValid { get; set; }
    public string? SignatureValueError { get; set; }
    public bool HasSignature { get; set; }
    public bool HasKeyInfoId { get; set; }
    public bool IsKeyInfoReferenced { get; set; }
    public bool IsSignedPropertiesReferenced { get; set; }
    public bool HasSignedDataObjectProperties { get; set; }
    public bool HasDataObjectFormat { get; set; }
    public string? SignatureMethod { get; set; }
    public string? DigestMethod { get; set; }
    public List<string> ReferenceUris { get; set; } = new();
    public List<SriXmlReferenceDiagnostic> ReferenceDiagnostics { get; set; } = new();
    public SriXmlCanonicalComparisonDiagnostic? ComprobanteCanonicalComparison { get; set; }
    public List<SriXmlSignatureVariantDiagnostic> VariantDiagnostics { get; set; } = new();
}

public class SriXmlReferenceDiagnostic
{
    public string? ReferenceUri { get; set; }
    public string? DigestMethod { get; set; }
    public string? StoredDigestValue { get; set; }
    public string? RecalculatedDigestValue { get; set; }
    public bool? DigestMatches { get; set; }
    public List<string> TransformChain { get; set; } = new();
    public bool ElementFound { get; set; }
    public string? ElementName { get; set; }
    public string? ElementId { get; set; }
    public string? Error { get; set; }
}

public class SriXmlCanonicalComparisonDiagnostic
{
    public int BeforeSignatureBytes { get; set; }
    public string? BeforeSignatureSha1 { get; set; }
    public string? BeforeSignatureSha256 { get; set; }
    public int AfterSignatureBytes { get; set; }
    public string? AfterSignatureSha1 { get; set; }
    public string? AfterSignatureSha256 { get; set; }
    public bool ChangedAfterAppendingSignature { get; set; }
    public string? PossibleCause { get; set; }
}

public class SriXmlSignatureVariantDiagnostic
{
    public string Name { get; set; } = string.Empty;
    public List<string> ReferenceUris { get; set; } = new();
    public bool? SignatureValueValid { get; set; }
    public bool? CheckSignatureWithCertificate { get; set; }
    public bool? CheckSignatureWithKeyInfo { get; set; }
    public List<SriXmlReferenceDiagnostic> ReferenceDiagnostics { get; set; } = new();
    public bool HasSignedDataObjectProperties { get; set; }
    public bool HasDataObjectFormat { get; set; }
    public SriXmlCanonicalComparisonDiagnostic? ComprobanteCanonicalComparison { get; set; }
    public string? Error { get; set; }
}
