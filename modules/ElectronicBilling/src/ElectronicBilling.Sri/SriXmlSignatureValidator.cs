using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Xml;
using ElectronicBilling.Core.Interfaces;

namespace ElectronicBilling.Sri;

public class SriXmlSignatureValidator : ISriXmlSignatureValidator
{
    public XmlSignatureValidationResult ValidateSignature(string signedXmlString)
    {
        var result = new XmlSignatureValidationResult();

        if (string.IsNullOrEmpty(signedXmlString))
        {
            result.ErrorMessage = "El contenido XML está vacío.";
            return result;
        }

        try
        {
            var xmlDoc = new XmlDocument { PreserveWhitespace = true };
            xmlDoc.LoadXml(signedXmlString);

            var signatureList = xmlDoc.GetElementsByTagName("Signature", "http://www.w3.org/2000/09/xmldsig#");
            if (signatureList.Count == 0)
            {
                signatureList = xmlDoc.GetElementsByTagName("ds:Signature");
            }

            if (signatureList.Count == 0)
            {
                result.ErrorMessage = "No se encontró el elemento <Signature> en el documento XML.";
                return result;
            }

            var signatureElement = (XmlElement)signatureList[0]!;
            var signedXml = new SriSignedXml(xmlDoc);
            signedXml.LoadXml(signatureElement);

            // Extract X509 Certificate from KeyInfo
            X509Certificate2? x509Cert = null;
            foreach (KeyInfoClause clause in signedXml.KeyInfo)
            {
                if (clause is KeyInfoX509Data x509Data && x509Data.Certificates != null)
                {
                    foreach (var item in x509Data.Certificates)
                    {
                        if (item is X509Certificate2 cert)
                        {
                            x509Cert = cert;
                            break;
                        }
                    }
                }
            }

            if (x509Cert != null)
            {
                result.SigningCertificateSubject = x509Cert.Subject;
                result.SigningCertificateExpiry = x509Cert.NotAfter;
            }

            // 1. Check Signature with KeyInfo
            try
            {
                result.CheckSignatureWithKeyInfo = signedXml.CheckSignatureReturningKey(out var _);
            }
            catch (Exception exKey)
            {
                result.CheckSignatureWithKeyInfo = false;
                result.ErrorMessage = $"CheckSignatureWithKeyInfo ex: {exKey.Message}";
            }

            // 2. Check Signature with Certificate
            if (x509Cert != null)
            {
                try
                {
                    result.CheckSignatureWithCertificate = signedXml.CheckSignature(x509Cert, verifySignatureOnly: true);
                }
                catch (Exception exCert)
                {
                    result.CheckSignatureWithCertificate = false;
                    result.ErrorMessage = (result.ErrorMessage ?? "") + $" | CheckSignatureWithCert ex: {exCert.Message}";
                }
            }
            else
            {
                result.CheckSignatureWithCertificate = result.CheckSignatureWithKeyInfo;
            }

            result.DigestValueValid = true;
            result.SignatureValueValid = result.CheckSignatureWithKeyInfo || result.CheckSignatureWithCertificate;
            result.IsValid = result.DigestValueValid && result.SignatureValueValid;

            if (!result.IsValid)
            {
                result.ErrorMessage = $"Firma no válida. CheckSignatureWithKeyInfo={result.CheckSignatureWithKeyInfo}, CheckSignatureWithCertificate={result.CheckSignatureWithCertificate}";
            }

            return result;
        }
        catch (Exception ex)
        {
            result.IsValid = false;
            result.ErrorMessage = $"Excepción durante la validación de la firma: {ex.Message}";
            return result;
        }
    }
}
