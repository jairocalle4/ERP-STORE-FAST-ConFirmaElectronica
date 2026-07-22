using System.Xml.Linq;
using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Enums;
using ElectronicBilling.Sri;
using Xunit;

namespace ElectronicBilling.Tests;

public class SriXmlBuilderTests
{
    [Fact]
    public void BuildInvoiceXml_ShouldGenerateValidSriXmlStructureAndTotals()
    {
        // Arrange
        var request = new ElectronicInvoiceRequest
        {
            TenantId = "tenant_test_123",
            Issuer = new IssuerData
            {
                Ruc = "0929433514001",
                SocialReason = "JC TECH SOLUCIONES",
                MainAddress = "Guayaquil, Ecuador",
                Environment = SriEnvironment.Test
            },
            Establishment = new EstablishmentData
            {
                Code = "001",
                EmissionPointCode = "002",
                Address = "Guayaquil, Ecuador"
            },
            Customer = new CustomerData
            {
                IdentificationType = IdentificationType.Cedula,
                IdentificationNumber = "0929433514",
                SocialReason = "Cliente Pruebas",
                Address = "Guayaquil",
                Email = "cliente@pruebas.com"
            },
            Lines = new List<InvoiceLine>
            {
                new InvoiceLine
                {
                    ItemCode = "PROD-001",
                    Description = "Licencia Software SaaS",
                    Quantity = 2,
                    UnitPrice = 100.00m,
                    Discount = 10.00m,
                    Taxes = new List<TaxDetail>
                    {
                        new TaxDetail
                        {
                            TaxType = TaxType.Iva,
                            PercentageCode = "4", // 15%
                            Rate = 15.00m,
                            TaxableBase = 190.00m
                        }
                    }
                }
            },
            Payments = new List<PaymentDetail>
            {
                new PaymentDetail
                {
                    PaymentMethod = PaymentMethod.SinUtilizacionSistemaFinanciero,
                    Total = 218.50m
                }
            }
        };

        var accessKey = AccessKeyGenerator.GenerateAccessKey(request.EmissionDate, DocumentType.Invoice, request.Issuer.Ruc, request.Issuer.Environment, request.Establishment.Code, request.Establishment.EmissionPointCode, "000000001");

        // Act
        var xmlString = SriXmlBuilder.BuildInvoiceXml(request, accessKey, "000000001");

        // Assert
        Assert.NotNull(xmlString);
        var xdoc = XDocument.Parse(xmlString);
        Assert.Equal("factura", xdoc.Root?.Name.LocalName);
        Assert.Equal("1.1.0", xdoc.Root?.Attribute("version")?.Value);
        Assert.Equal(accessKey, xdoc.Root?.Element("infoTributaria")?.Element("claveAcceso")?.Value);
        Assert.Equal("190.00", xdoc.Root?.Element("infoFactura")?.Element("totalSinImpuestos")?.Value);
        Assert.Equal("218.50", xdoc.Root?.Element("infoFactura")?.Element("importeTotal")?.Value);
    }

    [Fact]
    public void BuildInvoiceXml_TaxCalculationsAndBreakdown_ShouldGroupMultipleTaxRatesCorrectly()
    {
        // Arrange
        var request = new ElectronicInvoiceRequest
        {
            TenantId = "tenant_taxes_test",
            Issuer = new IssuerData
            {
                Ruc = "1790016919001",
                SocialReason = "EMPRESA DE PRUEBA S.A.",
                MainAddress = "Quito",
                Environment = SriEnvironment.Test
            },
            Establishment = new EstablishmentData { Code = "001", EmissionPointCode = "001", Address = "Quito" },
            Customer = new CustomerData { IdentificationType = IdentificationType.Ruc, IdentificationNumber = "1790016919001", SocialReason = "CLIENTE COMPRADOR", Address = "Quito" },
            Lines = new List<InvoiceLine>
            {
                // Item 1: IVA 15% ($100 subtotal -> $15 IVA)
                new InvoiceLine
                {
                    ItemCode = "ITEM-15", Description = "Producto IVA 15%", Quantity = 1, UnitPrice = 100m,
                    Taxes = new List<TaxDetail> { new TaxDetail { TaxType = TaxType.Iva, PercentageCode = "4", Rate = 15m, TaxableBase = 100m } }
                },
                // Item 2: IVA 0% ($50 subtotal -> $0 IVA)
                new InvoiceLine
                {
                    ItemCode = "ITEM-0", Description = "Producto IVA 0%", Quantity = 1, UnitPrice = 50m,
                    Taxes = new List<TaxDetail> { new TaxDetail { TaxType = TaxType.Iva, PercentageCode = "0", Rate = 0m, TaxableBase = 50m } }
                }
            },
            Payments = new List<PaymentDetail> { new PaymentDetail { PaymentMethod = PaymentMethod.SinUtilizacionSistemaFinanciero, Total = 165m } }
        };

        var accessKey = AccessKeyGenerator.GenerateAccessKey(DateTime.Now, DocumentType.Invoice, request.Issuer.Ruc, SriEnvironment.Test, "001", "001", "000000002");

        // Act
        var xmlString = SriXmlBuilder.BuildInvoiceXml(request, accessKey, "000000002");

        // Assert
        Assert.NotNull(xmlString);
        var xdoc = XDocument.Parse(xmlString);
        
        // Total sin impuestos = 100 + 50 = 150
        Assert.Equal("150.00", xdoc.Root?.Element("infoFactura")?.Element("totalSinImpuestos")?.Value);
        
        // Importe Total = 150 + 15 = 165
        Assert.Equal("165.00", xdoc.Root?.Element("infoFactura")?.Element("importeTotal")?.Value);

        // Verificar resumen de impuestos en totalConImpuestos
        var totalImpuestos = xdoc.Root?.Element("infoFactura")?.Element("totalConImpuestos")?.Elements("totalImpuesto").ToList();
        Assert.NotNull(totalImpuestos);
        Assert.True(totalImpuestos?.Count >= 2, "Debe incluir desgloses de impuestos para IVA 15% y IVA 0%");
    }
}
