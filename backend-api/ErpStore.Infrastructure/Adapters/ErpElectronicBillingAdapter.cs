using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Enums;
using ErpStore.Domain.Entities;

namespace ErpStore.Infrastructure.Adapters;

/// <summary>
/// Adaptador del ERP que transforma las entidades del ERP (Sale, Client, CompanySetting)
/// al DTO/Contrato estándar (ElectronicInvoiceRequest) del módulo autónomo ElectronicBilling.
/// </summary>
public static class ErpElectronicBillingAdapter
{
    public static ElectronicInvoiceRequest ToElectronicInvoiceRequest(
        Sale sale,
        Client? client,
        CompanySetting company,
        string? tenantId = null)
    {
        if (sale == null) throw new ArgumentNullException(nameof(sale));
        if (company == null) throw new ArgumentNullException(nameof(company));

        var effectiveTenantId = string.IsNullOrWhiteSpace(tenantId)
            ? (!string.IsNullOrWhiteSpace(company.Ruc) ? company.Ruc : "default_tenant")
            : tenantId;

        // 1. Emisor
        var sriEnvironment = company.SriEnvironment == "2" ? SriEnvironment.Production : SriEnvironment.Test;
        string? rimpe = company.TributaryRegime switch
        {
            "RIMPE_NEGOCIO_POPULAR" => "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
            "RIMPE_EMPRENDEDOR" => "CONTRIBUYENTE RÉGIMEN RIMPE",
            _ => null
        };

        var issuer = new IssuerData
        {
            Ruc = string.IsNullOrWhiteSpace(company.Ruc) ? "0000000000001" : company.Ruc,
            SocialReason = string.IsNullOrWhiteSpace(company.SocialReason) ? company.Name : company.SocialReason,
            CommercialName = string.IsNullOrWhiteSpace(company.CommercialName) ? company.Name : company.CommercialName,
            MainAddress = string.IsNullOrWhiteSpace(company.Address) ? "Ecuador" : company.Address,
            IsObligedToKeepAccounts = false,
            RimpeType = rimpe,
            Environment = sriEnvironment
        };

        // 2. Establecimiento y Punto de Emisión
        var establishment = new EstablishmentData
        {
            Code = (company.SriEstablishment ?? "001").PadLeft(3, '0'),
            EmissionPointCode = (company.SriPointOfIssue ?? "001").PadLeft(3, '0'),
            Address = string.IsNullOrWhiteSpace(company.Address) ? "Ecuador" : company.Address
        };

        // 3. Cliente / Comprador
        IdentificationType idType;
        string idNumber;

        if (client == null || string.IsNullOrWhiteSpace(client.CedulaRuc) || client.CedulaRuc == "9999999999" || client.CedulaRuc == "9999999999999")
        {
            idType = IdentificationType.FinalConsumer;
            idNumber = "9999999999999";
        }
        else
        {
            var rawType = client.IdentificationType?.ToUpperInvariant();
            if (rawType == "RUC" || client.CedulaRuc.Length == 13)
            {
                idType = IdentificationType.Ruc;
            }
            else if (rawType == "PASAPORTE")
            {
                idType = IdentificationType.Passport;
            }
            else
            {
                idType = IdentificationType.Cedula;
            }
            idNumber = client.CedulaRuc;
        }

        var customer = new CustomerData
        {
            IdentificationType = idType,
            IdentificationNumber = idNumber,
            SocialReason = string.IsNullOrWhiteSpace(client?.Name) ? "Consumidor Final" : client.Name,
            Address = string.IsNullOrWhiteSpace(client?.Address) ? "Ecuador" : client.Address,
            Email = string.IsNullOrWhiteSpace(client?.Email) ? "notiene@correo.com" : client.Email,
            Phone = client?.Phone
        };

        // 4. Detalle de Líneas e Impuestos
        var lines = new List<InvoiceLine>();
        decimal calculatedTotalIva = 0m;

        if (sale.SaleDetails != null)
        {
            foreach (var detail in sale.SaleDetails)
            {
                var taxRate = company.IvaRate;
                var percentageCode = taxRate == 15m ? "4" : (taxRate == 12m ? "2" : "0");
                var taxableBase = detail.Subtotal;
                var lineIva = Math.Round(taxableBase * (taxRate / 100m), 2, MidpointRounding.AwayFromZero);
                calculatedTotalIva += lineIva;

                lines.Add(new InvoiceLine
                {
                    ItemCode = detail.ProductId.ToString(),
                    AuxiliaryCode = detail.ProductId.ToString(),
                    Description = detail.Product?.Name ?? "Producto",
                    Quantity = detail.Quantity,
                    UnitPrice = detail.UnitPrice,
                    Discount = 0m,
                    Taxes = new List<TaxDetail>
                    {
                        new TaxDetail
                        {
                            TaxType = TaxType.Iva,
                            PercentageCode = percentageCode,
                            Rate = taxRate,
                            TaxableBase = taxableBase
                        }
                    }
                });
            }
        }

        // 5. Forma de Pago
        var paymentTotal = sale.Total + calculatedTotalIva;
        var payments = new List<PaymentDetail>
        {
            new PaymentDetail
            {
                PaymentMethod = PaymentMethod.SinUtilizacionSistemaFinanciero,
                Total = Math.Round(paymentTotal, 2, MidpointRounding.AwayFromZero),
                TimeLimit = 0,
                TimeUnit = "dias"
            }
        };

        // 6. Construir solicitud completa
        return new ElectronicInvoiceRequest
        {
            TenantId = effectiveTenantId,
            SourceSystem = "ERP-STORE-FAST",
            SourceEntityType = "Sale",
            SourceEntityId = sale.Id.ToString(),
            IdempotencyKey = $"sale_{sale.Id}_{sale.Date.Ticks}",
            Issuer = issuer,
            Establishment = establishment,
            Customer = customer,
            Lines = lines,
            Payments = payments,
            EmissionDate = sale.Date,
            Sequential = sale.NoteNumber?.Contains("-") == true ? sale.NoteNumber.Split('-')[2] : null,
            AdditionalInfo = sale.Observation
        };
    }
}
