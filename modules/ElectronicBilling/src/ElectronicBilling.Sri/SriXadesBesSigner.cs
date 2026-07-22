using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using ElectronicBilling.Core.Interfaces;

namespace ElectronicBilling.Sri;

public class SriSignedXml : SignedXml
{
    public SriSignedXml(XmlDocument document) : base(document) { }
    public SriSignedXml(XmlElement element) : base(element) { }

    public override XmlElement? GetIdElement(XmlDocument? document, string idValue)
    {
        var idElement = base.GetIdElement(document, idValue);
        if (idElement != null) return idElement;

        // Search Objects inside Signature FIRST so SignedProperties is ALWAYS resolved from DataObject
        foreach (DataObject dataObject in m_signature.ObjectList)
        {
            var node = dataObject.GetXml().SelectSingleNode($"//*[@Id='{idValue}' or @id='{idValue}']");
            if (node is XmlElement elem) return elem;
        }

        if (document != null)
        {
            var node = document.SelectSingleNode($"//*[@Id='{idValue}' or @id='{idValue}']");
            if (node is XmlElement elem) return elem;
        }

        return null;
    }
}

public class SriXadesBesSigner : ISriXmlSigner
{
    public string SignXml(string xmlString, byte[] p12Bytes, string p12Password)
    {
        if (string.IsNullOrEmpty(xmlString))
            throw new ArgumentNullException(nameof(xmlString));
        if (p12Bytes == null || p12Bytes.Length == 0)
            throw new ArgumentNullException(nameof(p12Bytes));

        using var certificate = X509CertificateLoader.LoadPkcs12(p12Bytes, p12Password, X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);
        
        using var rsaPrivateKey = certificate.GetRSAPrivateKey();
        using var rsaPublicKey = certificate.GetRSAPublicKey();

        if (rsaPrivateKey == null || rsaPublicKey == null)
        {
            throw new InvalidOperationException("El certificado digital no contiene una clave privada/pública RSA válida.");
        }

        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        xmlDoc.LoadXml(xmlString);

        var docElement = xmlDoc.DocumentElement ?? throw new InvalidOperationException("El documento XML no tiene elemento raíz.");
        if (!docElement.HasAttribute("id") && !docElement.HasAttribute("Id"))
        {
            docElement.SetAttribute("id", "comprobante");
        }

        var documentTargetId = docElement.GetAttribute("id");
        if (string.IsNullOrEmpty(documentTargetId))
        {
            documentTargetId = docElement.GetAttribute("Id");
        }
        if (string.IsNullOrEmpty(documentTargetId))
        {
            documentTargetId = "comprobante";
        }

        var randomId = RandomNumberGenerator.GetInt32(100000, 999999);
        var signatureId = $"Signature-{randomId}";
        var signedPropertiesId = $"SignedProperties-{signatureId}";
        var referenceId = $"Reference-Comprobante-{randomId}";

        var certHash = SHA1.HashData(certificate.RawData);
        var certHashBase64 = Convert.ToBase64String(certHash);

        var isoSigningTime = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var issuerName = certificate.IssuerName.Name;
        var serialNumber = certificate.SerialNumber;

        var signedPropertiesXml = $@"<etsi:QualifyingProperties xmlns:etsi=""http://uri.etsi.org/01903/v1.3.2#"" xmlns:ds=""http://www.w3.org/2000/09/xmldsig#"" xmlns=""http://www.w3.org/2000/09/xmldsig#"" Target=""#{signatureId}"">" +
            $@"<etsi:SignedProperties xmlns:etsi=""http://uri.etsi.org/01903/v1.3.2#"" xmlns:ds=""http://www.w3.org/2000/09/xmldsig#"" xmlns=""http://www.w3.org/2000/09/xmldsig#"" Id=""{signedPropertiesId}"">" +
            $@"<etsi:SignedSignatureProperties>" +
            $@"<etsi:SigningTime>{isoSigningTime}</etsi:SigningTime>" +
            $@"<etsi:SigningCertificate>" +
            $@"<etsi:Cert>" +
            $@"<etsi:CertDigest>" +
            $@"<ds:DigestMethod Algorithm=""http://www.w3.org/2000/09/xmldsig#sha1""/>" +
            $@"<ds:DigestValue>{certHashBase64}</ds:DigestValue>" +
            $@"</etsi:CertDigest>" +
            $@"<etsi:IssuerSerial>" +
            $@"<ds:X509IssuerName>{XmlEscape(issuerName)}</ds:X509IssuerName>" +
            $@"<ds:X509SerialNumber>{serialNumber}</ds:X509SerialNumber>" +
            $@"</etsi:IssuerSerial>" +
            $@"</etsi:Cert>" +
            $@"</etsi:SigningCertificate>" +
            $@"</etsi:SignedSignatureProperties>" +
            $@"<etsi:SignedDataObjectProperties>" +
            $@"<etsi:DataObjectFormat ObjectReference=""#{referenceId}"">" +
            $@"<etsi:Description>comprobante</etsi:Description>" +
            $@"<etsi:MimeType>text/xml</etsi:MimeType>" +
            $@"</etsi:DataObjectFormat>" +
            $@"</etsi:SignedDataObjectProperties>" +
            $@"</etsi:SignedProperties>" +
            $@"</etsi:QualifyingProperties>";

        var qualifyingDoc = new XmlDocument { PreserveWhitespace = true };
        qualifyingDoc.LoadXml(signedPropertiesXml);

        // Setup SignedXml
        var signedXml = new SriSignedXml(xmlDoc)
        {
            SigningKey = rsaPrivateKey
        };
        signedXml.Signature.Id = signatureId;

        // Reference 1: Main Document (<factura id="comprobante">)
        var referenceDocument = new Reference
        {
            Id = referenceId,
            Uri = $"#{documentTargetId}",
            DigestMethod = SignedXml.XmlDsigSHA1Url
        };
        referenceDocument.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        signedXml.AddReference(referenceDocument);

        // Reference 2: SignedProperties
        var referenceSignedProperties = new Reference
        {
            Uri = $"#{signedPropertiesId}",
            Type = "http://uri.etsi.org/01903#SignedProperties",
            DigestMethod = SignedXml.XmlDsigSHA1Url
        };
        signedXml.AddReference(referenceSignedProperties);

        // KeyInfo: Add X509Certificate AND RSAKeyValue
        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new KeyInfoX509Data(certificate));
        keyInfo.AddClause(new RSAKeyValue(rsaPublicKey));
        signedXml.KeyInfo = keyInfo;

        // Object: Add QualifyingProperties
        var dataObject = new DataObject();
        dataObject.LoadXml(qualifyingDoc.DocumentElement!);
        signedXml.AddObject(dataObject);

        // Compute Signature
        signedXml.ComputeSignature();

        // Get XmlElement for Signature and append to root
        var xmlDigitalSignature = signedXml.GetXml();
        docElement.AppendChild(xmlDoc.ImportNode(xmlDigitalSignature, true));

        return xmlDoc.OuterXml;
    }

    private static string XmlEscape(string unescaped)
    {
        return unescaped
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;")
            .Replace("'", "&apos;");
    }
}
