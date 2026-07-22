using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Xml;
using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Enums;
using ElectronicBilling.Sri;
using Xunit;

namespace ElectronicBilling.Tests;

public class SriXadesBesSignerAndValidatorTests
{
    [Fact]
    public void SignXmlAndValidate_ShouldPassAllXadesBesSignatureValidations()
    {
        // 1. Generate an ephemeral P12 certificate in memory for test
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest("CN=TEST FIRMA ELECTRONICA, O=JCTECH, C=EC", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = req.CreateSelfSigned(DateTimeOffset.Now.AddDays(-1), DateTimeOffset.Now.AddYears(1));
        var p12Bytes = cert.Export(X509ContentType.Pkcs12, "TestPassword123!");

        // 2. Build a valid SRI Invoice XML
        var invoiceRequest = new ElectronicInvoiceRequest
        {
            TenantId = "tenant_test",
            Issuer = new IssuerData
            {
                Ruc = "0929433514001",
                SocialReason = "JC TECH SOLUCIONES",
                MainAddress = "Guayaquil",
                Environment = SriEnvironment.Test
            },
            Establishment = new EstablishmentData { Code = "001", EmissionPointCode = "001", Address = "Guayaquil" },
            Customer = new CustomerData { IdentificationType = IdentificationType.Cedula, IdentificationNumber = "0929433514", SocialReason = "Prueba", Address = "Guayaquil" },
            Lines = new List<InvoiceLine>
            {
                new InvoiceLine { ItemCode = "001", Description = "Prueba", Quantity = 1, UnitPrice = 10, Taxes = new List<TaxDetail> { new TaxDetail { TaxType = TaxType.Iva, PercentageCode = "4", Rate = 15, TaxableBase = 10 } } }
            },
            Payments = new List<PaymentDetail> { new PaymentDetail { PaymentMethod = PaymentMethod.SinUtilizacionSistemaFinanciero, Total = 11.50m } }
        };

        var accessKey = AccessKeyGenerator.GenerateAccessKey(DateTime.Now, DocumentType.Invoice, "0929433514001", SriEnvironment.Test, "001", "001", "000000001");
        var rawXml = SriXmlBuilder.BuildInvoiceXml(invoiceRequest, accessKey, "000000001");

        // 3. Sign XML with SriXadesBesSigner
        var signer = new SriXadesBesSigner();
        var signedXml = signer.SignXml(rawXml, p12Bytes, "TestPassword123!");

        // Assert signedXml is produced
        Assert.NotNull(signedXml);
        Assert.Contains("Signature", signedXml);

        // 4. Validate signature with SriXmlSignatureValidator
        var validator = new SriXmlSignatureValidator();
        var validationResult = validator.ValidateSignature(signedXml);

        // Assert ALL 5 validation criteria specified by the user!
        Assert.True(validationResult.DigestValueValid, "DigestValue debe ser válido");
        Assert.True(validationResult.SignatureValueValid, $"SignatureValueValid debe ser true. Error: {validationResult.ErrorMessage}");
        Assert.True(validationResult.CheckSignatureWithKeyInfo, "CheckSignatureWithKeyInfo debe ser true");
        Assert.True(validationResult.CheckSignatureWithCertificate, "CheckSignatureWithCertificate debe ser true");
        Assert.True(validationResult.IsValid, $"Signature validation failed: {validationResult.ErrorMessage}");
    }

    [Fact]
    public void SignXml_ShouldIncludeSignedPropertiesElement_ForXadesBesCompliance()
    {
        // 1. Generate ephemeral P12 cert
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest("CN=TEST FIRMA SRI, O=JCTECH, C=EC", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = req.CreateSelfSigned(DateTimeOffset.Now.AddDays(-1), DateTimeOffset.Now.AddYears(1));
        var p12Bytes = cert.Export(X509ContentType.Pkcs12, "Password123!");

        // 2. Build invoice XML
        var invoiceRequest = new ElectronicInvoiceRequest
        {
            TenantId = "tenant_xades",
            Issuer = new IssuerData { Ruc = "0929433514001", SocialReason = "JC TECH", MainAddress = "Gye", Environment = SriEnvironment.Test },
            Establishment = new EstablishmentData { Code = "001", EmissionPointCode = "001", Address = "Gye" },
            Customer = new CustomerData { IdentificationType = IdentificationType.Cedula, IdentificationNumber = "0929433514", SocialReason = "Prueba", Address = "Gye" },
            Lines = new List<InvoiceLine> { new InvoiceLine { ItemCode = "1", Description = "Test", Quantity = 1, UnitPrice = 1, Taxes = new List<TaxDetail>() } },
            Payments = new List<PaymentDetail> { new PaymentDetail { Total = 1 } }
        };
        var accessKey = AccessKeyGenerator.GenerateAccessKey(DateTime.Now, DocumentType.Invoice, "0929433514001", SriEnvironment.Test, "001", "001", "000000003");
        var rawXml = SriXmlBuilder.BuildInvoiceXml(invoiceRequest, accessKey, "000000003");

        // 3. Sign
        var signer = new SriXadesBesSigner();
        var signedXml = signer.SignXml(rawXml, p12Bytes, "Password123!");

        // 4. Verify SignedProperties XAdES-BES node exists in XML
        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        xmlDoc.LoadXml(signedXml);

        var signedPropertiesList = xmlDoc.GetElementsByTagName("etsi:SignedProperties");
        if (signedPropertiesList.Count == 0)
        {
            signedPropertiesList = xmlDoc.GetElementsByTagName("SignedProperties");
        }

        Assert.True(signedPropertiesList.Count > 0, "El XML firmado debe contener el nodo XAdES <SignedProperties>");
    }
}
