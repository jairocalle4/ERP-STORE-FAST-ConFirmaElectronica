using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Xml;
using ErpStore.Application.DTOs;
using ErpStore.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace ErpStore.Infrastructure.Services;

/// <summary>
/// Firma XML SRI con una estructura XAdES-BES enveloped.
/// </summary>
public class SriXadesBesSigner : ISriXmlSigner
{
    private const string SignatureNs = SignedXml.XmlDsigNamespaceUrl;
    private const string XadesNs = "http://uri.etsi.org/01903/v1.3.2#";
    private const string RsaSha1Method = SignedXml.XmlDsigRSASHA1Url;
    private const string Sha1DigestMethod = SignedXml.XmlDsigSHA1Url;
    private const string CanonicalizationMethod = SignedXml.XmlDsigC14NTransformUrl;
    private const string SignedPropertiesType = "http://uri.etsi.org/01903#SignedProperties";

    private readonly ILogger<SriXadesBesSigner> _logger;

    public SriXadesBesSigner(ILogger<SriXadesBesSigner> logger)
    {
        _logger = logger;
    }

    public Task<SriXmlSignResult> SignXmlAsync(
        string xmlContent,
        byte[] certificateBytes,
        string? certificatePassword,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            using var cert = LoadCertificate(certificateBytes, certificatePassword);

            var xmlDoc = new XmlDocument { PreserveWhitespace = false };
            xmlDoc.LoadXml(xmlContent);

            using var rsa = cert.GetRSAPrivateKey()
                ?? throw new InvalidOperationException("El certificado no tiene clave privada RSA.");

            using var sha1 = SHA1.Create();
            var certDigestB64 = Convert.ToBase64String(sha1.ComputeHash(cert.RawData));

            var now = DateTime.UtcNow;
            var suffix = now.Ticks.ToString();
            var signatureId = $"Signature{suffix}";
            var signedPropsId = $"SignedProperties{suffix}";
            var keyInfoId = $"KeyInfo{suffix}";
            var objectId = $"Object{suffix}";
            var documentReferenceId = $"Reference{suffix}";

            var signedXml = new SriSignedXml(xmlDoc)
            {
                SigningKey = rsa
            };
            signedXml.Signature!.Id = signatureId;
            signedXml.SignedInfo!.SignatureMethod = RsaSha1Method;
            signedXml.SignedInfo.CanonicalizationMethod = CanonicalizationMethod;

            var qualifyingProperties = BuildQualifyingProperties(
                xmlDoc,
                cert,
                certDigestB64,
                now,
                signatureId,
                signedPropsId,
                documentReferenceId);

            var dataObject = new DataObject();
            dataObject.Id = objectId;
            var tempDoc = new XmlDocument { PreserveWhitespace = true };
            tempDoc.AppendChild(tempDoc.ImportNode(qualifyingProperties, true));
            dataObject.Data = tempDoc.ChildNodes;
            signedXml.AddObject(dataObject);

            var referenceDoc = new Reference
            {
                Id = documentReferenceId,
                Uri = "#comprobante",
                DigestMethod = Sha1DigestMethod
            };
            referenceDoc.AddTransform(new XmlDsigEnvelopedSignatureTransform());
            referenceDoc.AddTransform(new XmlDsigC14NTransform());
            signedXml.AddReference(referenceDoc);

            var referenceKeyInfo = new Reference
            {
                Uri = "#" + keyInfoId,
                DigestMethod = Sha1DigestMethod
            };
            referenceKeyInfo.AddTransform(new XmlDsigC14NTransform());
            signedXml.AddReference(referenceKeyInfo);

            var referenceProps = new Reference
            {
                Uri = "#" + signedPropsId,
                Type = SignedPropertiesType,
                DigestMethod = Sha1DigestMethod
            };
            referenceProps.AddTransform(new XmlDsigC14NTransform());
            signedXml.AddReference(referenceProps);

            var keyInfo = new KeyInfo { Id = keyInfoId };
            keyInfo.AddClause(new KeyInfoX509Data(cert));
            signedXml.KeyInfo = keyInfo;

            var comprobanteCanonicalBeforeSignature = CanonicalizeReferenceElement(
                xmlDoc.DocumentElement!,
                new[] { SignedXml.XmlDsigEnvelopedSignatureTransformUrl, SignedXml.XmlDsigC14NTransformUrl });

            signedXml.ComputeSignature();

            var xmlSignature = signedXml.GetXml();
            xmlDoc.DocumentElement!.AppendChild(xmlDoc.ImportNode(xmlSignature, true));

            var comprobanteCanonicalAfterSignature = CanonicalizeReferenceElement(
                xmlDoc.DocumentElement!,
                new[] { SignedXml.XmlDsigEnvelopedSignatureTransformUrl, SignedXml.XmlDsigC14NTransformUrl });

            var signedXmlContent = xmlDoc.OuterXml;
            var validation = ValidateSignature(signedXmlContent);
            validation.ComprobanteCanonicalComparison = BuildCanonicalComparison(
                comprobanteCanonicalBeforeSignature,
                comprobanteCanonicalAfterSignature);
            validation.VariantDiagnostics = BuildSignatureVariantDiagnostics(xmlContent, cert);

            _logger.LogInformation(
                "XML SRI firmado localmente. SignatureId: {SignatureId}, KeyInfoId: {KeyInfoId}, SignedPropertiesId: {SignedPropertiesId}, LocalValid: {LocalValid}",
                signatureId,
                keyInfoId,
                signedPropsId,
                validation.IsValid);

            return Task.FromResult(new SriXmlSignResult
            {
                Success = validation.IsValid,
                SignedXml = signedXmlContent,
                ErrorMessage = validation.IsValid ? null : validation.ErrorMessage,
                SignatureId = signatureId,
                KeyInfoId = keyInfoId,
                SignedPropertiesId = signedPropsId,
                ObjectId = objectId,
                CertificateThumbprintMasked = MaskThumbprint(cert.Thumbprint),
                SignatureMethod = RsaSha1Method,
                DigestMethod = Sha1DigestMethod,
                UsesSha1 = true,
                Validation = validation
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo firmar el XML SRI. No se registran secretos ni contenido del certificado.");
            return Task.FromResult(new SriXmlSignResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                SignatureMethod = RsaSha1Method,
                DigestMethod = Sha1DigestMethod,
                UsesSha1 = true
            });
        }
    }

    private List<SriXmlSignatureVariantDiagnostic> BuildSignatureVariantDiagnostics(
        string xmlContent,
        X509Certificate2 cert)
    {
        var variants = new[]
        {
            new SignatureVariantDefinition(
                "A - solo #comprobante | Type=none | SP-C14N=false | Order=no-xades-object",
                IncludeKeyInfoReference: false,
                IncludeSignedPropertiesReference: false,
                IncludeXadesObject: false,
                UseSignedPropertiesType: false,
                IncludeSignedPropertiesC14NTransform: false,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "C - #comprobante + #KeyInfo | Type=none | SP-C14N=false | Order=no-xades-object",
                IncludeKeyInfoReference: true,
                IncludeSignedPropertiesReference: false,
                IncludeXadesObject: false,
                UseSignedPropertiesType: false,
                IncludeSignedPropertiesC14NTransform: false,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "SP1 - #comprobante + #SignedProperties | Type=SignedProperties | SP-C14N=true | Order=AddObject-before-AddReference",
                IncludeKeyInfoReference: false,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: true,
                IncludeSignedPropertiesC14NTransform: true,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "SP2 - #comprobante + #SignedProperties | Type=none | SP-C14N=true | Order=AddObject-before-AddReference",
                IncludeKeyInfoReference: false,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: false,
                IncludeSignedPropertiesC14NTransform: true,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "SP3 - #comprobante + #SignedProperties | Type=SignedProperties | SP-C14N=false | Order=AddObject-before-AddReference",
                IncludeKeyInfoReference: false,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: true,
                IncludeSignedPropertiesC14NTransform: false,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "SP4 - #comprobante + #SignedProperties | Type=none | SP-C14N=false | Order=AddObject-before-AddReference",
                IncludeKeyInfoReference: false,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: false,
                IncludeSignedPropertiesC14NTransform: false,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "SP5 - #comprobante + #SignedProperties | Type=SignedProperties | SP-C14N=true | Order=AddReference-before-AddObject",
                IncludeKeyInfoReference: false,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: true,
                IncludeSignedPropertiesC14NTransform: true,
                AddObjectBeforeReferences: false),
            new SignatureVariantDefinition(
                "D - completa #comprobante + #KeyInfo + #SignedProperties | Type=SignedProperties | SP-C14N=true | Order=AddObject-before-AddReference",
                IncludeKeyInfoReference: true,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: true,
                IncludeSignedPropertiesC14NTransform: true,
                AddObjectBeforeReferences: true),
            new SignatureVariantDefinition(
                "D2 - completa #comprobante + #KeyInfo + #SignedProperties | Type=SignedProperties | SP-C14N=true | Order=AddReference-before-AddObject",
                IncludeKeyInfoReference: true,
                IncludeSignedPropertiesReference: true,
                IncludeXadesObject: true,
                UseSignedPropertiesType: true,
                IncludeSignedPropertiesC14NTransform: true,
                AddObjectBeforeReferences: false)
        };

        return variants
            .Select((variant, index) => BuildSignatureVariantDiagnostic(xmlContent, cert, variant, index))
            .ToList();
    }

    private SriXmlSignatureVariantDiagnostic BuildSignatureVariantDiagnostic(
        string xmlContent,
        X509Certificate2 cert,
        SignatureVariantDefinition variant,
        int index)
    {
        try
        {
            var xmlDoc = new XmlDocument { PreserveWhitespace = false };
            xmlDoc.LoadXml(xmlContent);

            using var rsa = cert.GetRSAPrivateKey()
                ?? throw new InvalidOperationException("El certificado no tiene clave privada RSA.");

            using var sha1 = SHA1.Create();
            var certDigestB64 = Convert.ToBase64String(sha1.ComputeHash(cert.RawData));

            var now = DateTime.UtcNow;
            var suffix = $"{now.Ticks}Variant{index}";
            var signatureId = $"Signature{suffix}";
            var signedPropsId = $"SignedProperties{suffix}";
            var keyInfoId = $"KeyInfo{suffix}";
            var objectId = $"Object{suffix}";
            var documentReferenceId = $"Reference{suffix}";

            var signedXml = new SriSignedXml(xmlDoc)
            {
                SigningKey = rsa
            };
            signedXml.Signature!.Id = signatureId;
            signedXml.SignedInfo!.SignatureMethod = RsaSha1Method;
            signedXml.SignedInfo.CanonicalizationMethod = CanonicalizationMethod;

            var xadesDataObject = variant.IncludeXadesObject
                ? BuildXadesDataObject(
                    xmlDoc,
                    cert,
                    certDigestB64,
                    now,
                    signatureId,
                    signedPropsId,
                    objectId,
                    documentReferenceId)
                : null;

            if (xadesDataObject != null && variant.AddObjectBeforeReferences)
                signedXml.AddObject(xadesDataObject);

            AddDiagnosticVariantReferences(
                signedXml,
                variant,
                documentReferenceId,
                keyInfoId,
                signedPropsId);

            if (xadesDataObject != null && !variant.AddObjectBeforeReferences)
                signedXml.AddObject(xadesDataObject);

            var keyInfo = new KeyInfo { Id = keyInfoId };
            keyInfo.AddClause(new KeyInfoX509Data(cert));
            signedXml.KeyInfo = keyInfo;

            var comprobanteCanonicalBeforeSignature = CanonicalizeReferenceElement(
                xmlDoc.DocumentElement!,
                new[] { SignedXml.XmlDsigEnvelopedSignatureTransformUrl, SignedXml.XmlDsigC14NTransformUrl });

            signedXml.ComputeSignature();

            var xmlSignature = signedXml.GetXml();
            xmlDoc.DocumentElement!.AppendChild(xmlDoc.ImportNode(xmlSignature, true));

            var comprobanteCanonicalAfterSignature = CanonicalizeReferenceElement(
                xmlDoc.DocumentElement!,
                new[] { SignedXml.XmlDsigEnvelopedSignatureTransformUrl, SignedXml.XmlDsigC14NTransformUrl });

            var validation = ValidateSignature(xmlDoc.OuterXml);

            return new SriXmlSignatureVariantDiagnostic
            {
                Name = variant.Name,
                ReferenceUris = validation.ReferenceUris,
                SignatureValueValid = validation.SignatureValueValid,
                CheckSignatureWithCertificate = validation.CheckSignatureWithCertificate,
                CheckSignatureWithKeyInfo = validation.CheckSignatureWithKeyInfo,
                ReferenceDiagnostics = validation.ReferenceDiagnostics,
                HasSignedDataObjectProperties = validation.HasSignedDataObjectProperties,
                HasDataObjectFormat = validation.HasDataObjectFormat,
                ComprobanteCanonicalComparison = BuildCanonicalComparison(
                    comprobanteCanonicalBeforeSignature,
                    comprobanteCanonicalAfterSignature),
                Error = validation.ErrorMessage
            };
        }
        catch (Exception ex)
        {
            return new SriXmlSignatureVariantDiagnostic
            {
                Name = variant.Name,
                Error = ex.Message
            };
        }
    }

    private static DataObject BuildXadesDataObject(
        XmlDocument xmlDoc,
        X509Certificate2 cert,
        string certDigestB64,
        DateTime now,
        string signatureId,
        string signedPropsId,
        string objectId,
        string documentReferenceId)
    {
        var qualifyingProperties = BuildQualifyingProperties(
            xmlDoc,
            cert,
            certDigestB64,
            now,
            signatureId,
            signedPropsId,
            documentReferenceId);

        var dataObject = new DataObject { Id = objectId };
        var tempDoc = new XmlDocument { PreserveWhitespace = true };
        tempDoc.AppendChild(tempDoc.ImportNode(qualifyingProperties, true));
        dataObject.Data = tempDoc.ChildNodes;
        return dataObject;
    }

    private static void AddDiagnosticVariantReferences(
        SignedXml signedXml,
        SignatureVariantDefinition variant,
        string documentReferenceId,
        string keyInfoId,
        string signedPropsId)
    {
        var referenceDoc = new Reference
        {
            Id = documentReferenceId,
            Uri = "#comprobante",
            DigestMethod = Sha1DigestMethod
        };
        referenceDoc.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        referenceDoc.AddTransform(new XmlDsigC14NTransform());
        signedXml.AddReference(referenceDoc);

        if (variant.IncludeKeyInfoReference)
        {
            var referenceKeyInfo = new Reference
            {
                Uri = "#" + keyInfoId,
                DigestMethod = Sha1DigestMethod
            };
            referenceKeyInfo.AddTransform(new XmlDsigC14NTransform());
            signedXml.AddReference(referenceKeyInfo);
        }

        if (variant.IncludeSignedPropertiesReference)
        {
            var referenceProps = new Reference
            {
                Uri = "#" + signedPropsId,
                Type = variant.UseSignedPropertiesType ? SignedPropertiesType : null,
                DigestMethod = Sha1DigestMethod
            };

            if (variant.IncludeSignedPropertiesC14NTransform)
                referenceProps.AddTransform(new XmlDsigC14NTransform());

            signedXml.AddReference(referenceProps);
        }
    }

    private static string? MaskThumbprint(string? thumbprint)
    {
        if (string.IsNullOrWhiteSpace(thumbprint))
            return null;

        var normalized = thumbprint.Replace(" ", string.Empty);
        if (normalized.Length <= 8)
            return "****";

        return $"{normalized[..4]}...{normalized[^4..]}";
    }

    public SriXmlSignatureValidationResult ValidateSignature(string signedXmlContent)
    {
        var result = new SriXmlSignatureValidationResult();

        try
        {
            var xmlDoc = new XmlDocument { PreserveWhitespace = false };
            xmlDoc.LoadXml(signedXmlContent);

            var nsMgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsMgr.AddNamespace("ds", SignatureNs);
            nsMgr.AddNamespace("xades", XadesNs);

            var signatureElement = xmlDoc.SelectSingleNode("//ds:Signature", nsMgr) as XmlElement;
            result.HasSignature = signatureElement != null;
            if (signatureElement == null)
            {
                result.ErrorMessage = "El XML firmado no contiene ds:Signature.";
                return result;
            }

            result.SignatureMethod = xmlDoc.SelectSingleNode("//ds:SignedInfo/ds:SignatureMethod", nsMgr)
                is XmlElement signatureMethod
                    ? signatureMethod.GetAttribute("Algorithm")
                    : null;
            result.DigestMethod = xmlDoc.SelectSingleNode("//ds:SignedInfo/ds:Reference[1]/ds:DigestMethod", nsMgr)
                is XmlElement digestMethod
                    ? digestMethod.GetAttribute("Algorithm")
                    : null;

            var referenceNodes = xmlDoc.SelectNodes("//ds:SignedInfo/ds:Reference", nsMgr);
            if (referenceNodes != null)
            {
                foreach (XmlElement reference in referenceNodes.OfType<XmlElement>())
                {
                    var uri = reference.GetAttribute("URI");
                    if (!string.IsNullOrWhiteSpace(uri))
                        result.ReferenceUris.Add(uri);
                }
            }

            var keyInfoElement = xmlDoc.SelectSingleNode("//ds:Signature/ds:KeyInfo", nsMgr) as XmlElement;
            var keyInfoId = keyInfoElement?.GetAttribute("Id");
            result.HasKeyInfoId = !string.IsNullOrWhiteSpace(keyInfoId);
            result.IsKeyInfoReferenced = result.HasKeyInfoId && result.ReferenceUris.Contains("#" + keyInfoId);

            var signedPropertiesElement = xmlDoc.SelectSingleNode("//xades:SignedProperties", nsMgr) as XmlElement;
            var signedPropertiesId = signedPropertiesElement?.GetAttribute("Id");
            result.IsSignedPropertiesReferenced = !string.IsNullOrWhiteSpace(signedPropertiesId)
                && result.ReferenceUris.Contains("#" + signedPropertiesId);

            result.HasSignedDataObjectProperties =
                xmlDoc.SelectSingleNode("//xades:SignedDataObjectProperties", nsMgr) != null;
            result.HasDataObjectFormat =
                xmlDoc.SelectSingleNode("//xades:SignedDataObjectProperties/xades:DataObjectFormat", nsMgr) != null;

            result.ReferenceDiagnostics = BuildReferenceDiagnostics(xmlDoc, nsMgr);
            result.SignatureValueValid = VerifySignatureValue(xmlDoc, nsMgr, out var signatureValueError);
            result.SignatureValueError = signatureValueError;

            var signedXml = new SriSignedXml(xmlDoc);
            signedXml.LoadXml(signatureElement);
            result.CheckSignatureWithKeyInfo = signedXml.CheckSignature();
            result.CheckSignatureWithCertificate = CheckSignatureWithEmbeddedCertificate(
                signedXml,
                xmlDoc,
                nsMgr,
                out var checkSignatureWithCertificateError);
            result.CheckSignatureWithCertificateError = checkSignatureWithCertificateError;
            result.IsValid = result.CheckSignatureWithCertificate == true;

            if (!result.IsValid)
                result.ErrorMessage = "La validacion criptografica local de la firma XML fallo.";
            else if (result.SignatureValueValid != true)
                result.ErrorMessage = "La firma local es valida, pero la verificacion manual de SignatureValue fallo.";
            else if (result.ReferenceDiagnostics.Any(d => d.DigestMatches == false))
                result.ErrorMessage = "La firma local es valida, pero al menos un digest recalculado no coincide.";
            else if (!result.HasKeyInfoId || !result.IsKeyInfoReferenced)
                result.ErrorMessage = "La firma local es valida, pero KeyInfo no tiene Id o no esta referenciado.";
            else if (!result.IsSignedPropertiesReferenced)
                result.ErrorMessage = "La firma local es valida, pero SignedProperties no esta referenciado.";
            else if (!result.HasSignedDataObjectProperties || !result.HasDataObjectFormat)
                result.ErrorMessage = "La firma local es valida, pero faltan SignedDataObjectProperties o DataObjectFormat.";

            result.IsValid = result.IsValid
                && result.HasKeyInfoId
                && result.IsKeyInfoReferenced
                && result.IsSignedPropertiesReferenced
                && result.HasSignedDataObjectProperties
                && result.HasDataObjectFormat
                && result.SignatureValueValid == true
                && result.ReferenceDiagnostics.All(d => d.DigestMatches != false);

            return result;
        }
        catch (Exception ex)
        {
            result.ErrorMessage = ex.Message;
            return result;
        }
    }

    private static List<SriXmlReferenceDiagnostic> BuildReferenceDiagnostics(
        XmlDocument xmlDoc,
        XmlNamespaceManager nsMgr)
    {
        var diagnostics = new List<SriXmlReferenceDiagnostic>();
        var referenceNodes = xmlDoc.SelectNodes("//ds:SignedInfo/ds:Reference", nsMgr);
        if (referenceNodes == null)
            return diagnostics;

        foreach (XmlElement reference in referenceNodes.OfType<XmlElement>())
        {
            var diagnostic = new SriXmlReferenceDiagnostic
            {
                ReferenceUri = reference.GetAttribute("URI"),
                DigestMethod = (reference.SelectSingleNode("ds:DigestMethod", nsMgr) as XmlElement)
                    ?.GetAttribute("Algorithm"),
                StoredDigestValue = reference.SelectSingleNode("ds:DigestValue", nsMgr)?.InnerText?.Trim()
            };

            var transformNodes = reference.SelectNodes("ds:Transforms/ds:Transform", nsMgr);
            if (transformNodes != null)
            {
                foreach (XmlElement transform in transformNodes.OfType<XmlElement>())
                {
                    diagnostic.TransformChain.Add(transform.GetAttribute("Algorithm"));
                }
            }

            try
            {
                if (string.IsNullOrWhiteSpace(diagnostic.ReferenceUri) ||
                    !diagnostic.ReferenceUri.StartsWith("#", StringComparison.Ordinal))
                {
                    diagnostic.Error = "Solo se soportan URIs internas con fragmento para diagnostico.";
                    diagnostics.Add(diagnostic);
                    continue;
                }

                if (diagnostic.DigestMethod != Sha1DigestMethod)
                {
                    diagnostic.Error = $"DigestMethod no soportado por diagnostico manual: {diagnostic.DigestMethod}";
                    diagnostics.Add(diagnostic);
                    continue;
                }

                var id = diagnostic.ReferenceUri[1..];
                var referencedElement = FindElementById(xmlDoc, id);
                diagnostic.ElementFound = referencedElement != null;
                diagnostic.ElementName = referencedElement?.Name;
                diagnostic.ElementId = referencedElement?.GetAttribute("Id");
                if (string.IsNullOrWhiteSpace(diagnostic.ElementId))
                    diagnostic.ElementId = referencedElement?.GetAttribute("id");

                if (referencedElement == null)
                {
                    diagnostic.Error = "No se encontro el elemento referenciado.";
                    diagnostics.Add(diagnostic);
                    continue;
                }

                var canonicalized = CanonicalizeReferenceElement(
                    referencedElement,
                    diagnostic.TransformChain);
                using var sha1 = SHA1.Create();
                diagnostic.RecalculatedDigestValue = Convert.ToBase64String(sha1.ComputeHash(canonicalized));
                diagnostic.DigestMatches = string.Equals(
                    diagnostic.StoredDigestValue,
                    diagnostic.RecalculatedDigestValue,
                    StringComparison.Ordinal);
            }
            catch (Exception ex)
            {
                diagnostic.Error = ex.Message;
            }

            diagnostics.Add(diagnostic);
        }

        return diagnostics;
    }

    private static bool? VerifySignatureValue(
        XmlDocument xmlDoc,
        XmlNamespaceManager nsMgr,
        out string? error)
    {
        error = null;

        try
        {
            var signedInfo = xmlDoc.SelectSingleNode("//ds:Signature/ds:SignedInfo", nsMgr) as XmlElement;
            var signatureValueText = xmlDoc.SelectSingleNode("//ds:Signature/ds:SignatureValue", nsMgr)
                ?.InnerText?.Trim();
            var certificateText = xmlDoc.SelectSingleNode("//ds:Signature/ds:KeyInfo/ds:X509Data/ds:X509Certificate", nsMgr)
                ?.InnerText?.Trim();

            if (signedInfo == null || string.IsNullOrWhiteSpace(signatureValueText) ||
                string.IsNullOrWhiteSpace(certificateText))
            {
                error = "Faltan SignedInfo, SignatureValue o X509Certificate para verificar SignatureValue.";
                return null;
            }

            var canonicalizedSignedInfo = CanonicalizeElement(signedInfo);
            var signatureValue = Convert.FromBase64String(signatureValueText);
            var certificateBytes = Convert.FromBase64String(certificateText);
            using var cert = new X509Certificate2(certificateBytes);
            using var rsa = cert.GetRSAPublicKey();
            if (rsa == null)
            {
                error = "El certificado no contiene clave publica RSA.";
                return null;
            }

            return rsa.VerifyData(
                canonicalizedSignedInfo,
                signatureValue,
                HashAlgorithmName.SHA1,
                RSASignaturePadding.Pkcs1);
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return null;
        }
    }

    private static bool? CheckSignatureWithEmbeddedCertificate(
        SignedXml signedXml,
        XmlDocument xmlDoc,
        XmlNamespaceManager nsMgr,
        out string? error)
    {
        error = null;

        try
        {
            var certificateText = xmlDoc.SelectSingleNode("//ds:Signature/ds:KeyInfo/ds:X509Data/ds:X509Certificate", nsMgr)
                ?.InnerText?.Trim();

            if (string.IsNullOrWhiteSpace(certificateText))
            {
                error = "No se encontro X509Certificate embebido en KeyInfo.";
                return null;
            }

            var certificateBytes = Convert.FromBase64String(certificateText);
            using var cert = new X509Certificate2(certificateBytes);
            return signedXml.CheckSignature(cert, verifySignatureOnly: true);
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return null;
        }
    }

    private static XmlElement? FindElementById(XmlDocument xmlDoc, string id)
    {
        var nodeList = xmlDoc.SelectNodes($"//*[@id='{id}'] | //*[@Id='{id}']");
        return nodeList != null && nodeList.Count > 0
            ? nodeList[0] as XmlElement
            : null;
    }

    private static byte[] CanonicalizeReferenceElement(
        XmlElement element,
        IReadOnlyCollection<string> transformChain)
    {
        var workingDoc = new XmlDocument { PreserveWhitespace = true };
        workingDoc.AppendChild(workingDoc.ImportNode(element, true));

        foreach (var transform in transformChain)
        {
            if (transform == SignedXml.XmlDsigEnvelopedSignatureTransformUrl)
            {
                RemoveSignatureElements(workingDoc);
                continue;
            }

            if (transform == SignedXml.XmlDsigC14NTransformUrl)
                continue;

            throw new InvalidOperationException($"Transform no soportado por diagnostico manual: {transform}");
        }

        return CanonicalizeDocument(workingDoc);
    }

    private static SriXmlCanonicalComparisonDiagnostic BuildCanonicalComparison(
        byte[] beforeSignature,
        byte[] afterSignature)
    {
        var beforeSha1 = ComputeHashBase64(beforeSignature, SHA1.HashData);
        var afterSha1 = ComputeHashBase64(afterSignature, SHA1.HashData);
        var beforeSha256 = ComputeHashBase64(beforeSignature, SHA256.HashData);
        var afterSha256 = ComputeHashBase64(afterSignature, SHA256.HashData);
        var changed = !CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(beforeSignature),
            SHA256.HashData(afterSignature));

        return new SriXmlCanonicalComparisonDiagnostic
        {
            BeforeSignatureBytes = beforeSignature.Length,
            BeforeSignatureSha1 = beforeSha1,
            BeforeSignatureSha256 = beforeSha256,
            AfterSignatureBytes = afterSignature.Length,
            AfterSignatureSha1 = afterSha1,
            AfterSignatureSha256 = afterSha256,
            ChangedAfterAppendingSignature = changed,
            PossibleCause = changed
                ? "El canonical form de #comprobante cambio despues de anexar ds:Signature; revisar whitespace/namespaces o transform enveloped."
                : "El canonical form de #comprobante se mantiene estable despues de anexar ds:Signature."
        };
    }

    private static string ComputeHashBase64(byte[] data, Func<byte[], byte[]> hash)
    {
        return Convert.ToBase64String(hash(data));
    }

    private static byte[] CanonicalizeElement(XmlElement element)
    {
        var tempDoc = new XmlDocument { PreserveWhitespace = true };
        tempDoc.AppendChild(tempDoc.ImportNode(element, true));
        return CanonicalizeDocument(tempDoc);
    }

    private static byte[] CanonicalizeDocument(XmlDocument document)
    {
        var transform = new XmlDsigC14NTransform();
        transform.LoadInput(document);
        using var stream = (Stream)transform.GetOutput(typeof(Stream));
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return memory.ToArray();
    }

    private static void RemoveSignatureElements(XmlDocument document)
    {
        var nsMgr = new XmlNamespaceManager(document.NameTable);
        nsMgr.AddNamespace("ds", SignatureNs);
        var signatureNodes = document.SelectNodes("//ds:Signature", nsMgr);
        if (signatureNodes == null) return;

        foreach (XmlNode node in signatureNodes)
        {
            node.ParentNode?.RemoveChild(node);
        }
    }

    private static X509Certificate2 LoadCertificate(byte[] certificateBytes, string? certificatePassword)
    {
        try
        {
            return X509CertificateLoader.LoadPkcs12(
                certificateBytes,
                certificatePassword ?? string.Empty,
                X509KeyStorageFlags.Exportable | X509KeyStorageFlags.PersistKeySet);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"No se pudo cargar el certificado .p12/.pfx. Verifica la contrasena. Detalle: {ex.Message}",
                ex);
        }
    }

    private static XmlElement BuildQualifyingProperties(
        XmlDocument xmlDoc,
        X509Certificate2 cert,
        string certDigestB64,
        DateTime signingDateUtc,
        string signatureId,
        string signedPropsId,
        string documentReferenceId)
    {
        var qualifyingProperties = xmlDoc.CreateElement("xades", "QualifyingProperties", XadesNs);
        qualifyingProperties.SetAttribute("Target", "#" + signatureId);
        qualifyingProperties.SetAttribute("xmlns:xades", XadesNs);

        var signedProperties = xmlDoc.CreateElement("xades", "SignedProperties", XadesNs);
        signedProperties.SetAttribute("Id", signedPropsId);

        var signedSignatureProperties = xmlDoc.CreateElement("xades", "SignedSignatureProperties", XadesNs);

        var signingTimeNode = xmlDoc.CreateElement("xades", "SigningTime", XadesNs);
        signingTimeNode.InnerText = signingDateUtc.ToString("yyyy-MM-ddTHH:mm:ssZ");
        signedSignatureProperties.AppendChild(signingTimeNode);

        var signingCertificate = xmlDoc.CreateElement("xades", "SigningCertificate", XadesNs);
        var certNode = xmlDoc.CreateElement("xades", "Cert", XadesNs);

        var certDigest = xmlDoc.CreateElement("xades", "CertDigest", XadesNs);
        var digestMethod = xmlDoc.CreateElement("ds", "DigestMethod", SignatureNs);
        digestMethod.SetAttribute("Algorithm", Sha1DigestMethod);
        var digestValue = xmlDoc.CreateElement("ds", "DigestValue", SignatureNs);
        digestValue.InnerText = certDigestB64;
        certDigest.AppendChild(digestMethod);
        certDigest.AppendChild(digestValue);

        var issuerSerial = xmlDoc.CreateElement("xades", "IssuerSerial", XadesNs);
        var issuerName = xmlDoc.CreateElement("ds", "X509IssuerName", SignatureNs);
        issuerName.InnerText = cert.IssuerName.Name ?? cert.Issuer;
        var serialNumber = xmlDoc.CreateElement("ds", "X509SerialNumber", SignatureNs);
        serialNumber.InnerText = BigIntegerFromHex(cert.SerialNumber).ToString();
        issuerSerial.AppendChild(issuerName);
        issuerSerial.AppendChild(serialNumber);

        certNode.AppendChild(certDigest);
        certNode.AppendChild(issuerSerial);
        signingCertificate.AppendChild(certNode);
        signedSignatureProperties.AppendChild(signingCertificate);
        signedProperties.AppendChild(signedSignatureProperties);

        var signedDataObjectProperties = xmlDoc.CreateElement("xades", "SignedDataObjectProperties", XadesNs);
        var dataObjectFormat = xmlDoc.CreateElement("xades", "DataObjectFormat", XadesNs);
        dataObjectFormat.SetAttribute("ObjectReference", "#" + documentReferenceId);
        var description = xmlDoc.CreateElement("xades", "Description", XadesNs);
        description.InnerText = "Comprobante electronico SRI";
        var mimeType = xmlDoc.CreateElement("xades", "MimeType", XadesNs);
        mimeType.InnerText = "text/xml";
        dataObjectFormat.AppendChild(description);
        dataObjectFormat.AppendChild(mimeType);
        signedDataObjectProperties.AppendChild(dataObjectFormat);
        signedProperties.AppendChild(signedDataObjectProperties);

        qualifyingProperties.AppendChild(signedProperties);
        return qualifyingProperties;
    }

    private static System.Numerics.BigInteger BigIntegerFromHex(string? hex)
    {
        if (string.IsNullOrWhiteSpace(hex)) return 0;
        return System.Numerics.BigInteger.Parse(
            "00" + hex,
            System.Globalization.NumberStyles.HexNumber);
    }

    private sealed record SignatureVariantDefinition(
        string Name,
        bool IncludeKeyInfoReference,
        bool IncludeSignedPropertiesReference,
        bool IncludeXadesObject,
        bool UseSignedPropertiesType,
        bool IncludeSignedPropertiesC14NTransform,
        bool AddObjectBeforeReferences);

    private sealed class SriSignedXml : SignedXml
    {
        public SriSignedXml(XmlDocument document) : base(document)
        {
        }

        public override XmlElement? GetIdElement(XmlDocument? document, string idValue)
        {
            if (document == null) return null;

            var element = base.GetIdElement(document, idValue);
            if (element != null) return element;

            var nodeList = document.SelectNodes($"//*[@id='{idValue}'] | //*[@Id='{idValue}']");
            if (nodeList != null && nodeList.Count > 0)
                return nodeList[0] as XmlElement;

            var keyInfoElement = Signature.KeyInfo?.GetXml();
            if (keyInfoElement?.GetAttribute("Id") == idValue)
                return keyInfoElement;

            foreach (DataObject dataObj in Signature.ObjectList)
            {
                if (dataObj.Data == null) continue;

                foreach (XmlNode node in dataObj.Data)
                {
                    if (node is not XmlElement el) continue;

                    if (el.GetAttribute("Id") == idValue || el.GetAttribute("id") == idValue)
                        return el;

                    var childList = el.SelectNodes($"//*[@id='{idValue}'] | //*[@Id='{idValue}']");
                    if (childList != null && childList.Count > 0)
                        return childList[0] as XmlElement;
                }
            }

            return null;
        }
    }
}
