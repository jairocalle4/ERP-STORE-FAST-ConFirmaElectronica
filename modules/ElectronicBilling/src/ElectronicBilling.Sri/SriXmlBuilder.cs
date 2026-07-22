using System.Globalization;
using System.Xml.Linq;
using ElectronicBilling.Core.Contracts;

namespace ElectronicBilling.Sri;

public static class SriXmlBuilder
{
    public static string BuildInvoiceXml(ElectronicInvoiceRequest request, string accessKey, string sequentialNumber)
    {
        var invCulture = CultureInfo.InvariantCulture;
        var formattedSequential = (sequentialNumber ?? "1").PadLeft(9, '0');
        var estab = request.Establishment.Code.PadLeft(3, '0');
        var pto = request.Establishment.EmissionPointCode.PadLeft(3, '0');
        var dateStr = request.EmissionDate.ToString("dd/MM/yyyy");

        // Tax totals calculation
        var taxGroups = request.Lines
            .SelectMany(l => l.Taxes)
            .GroupBy(t => new { t.TaxType, t.PercentageCode, t.Rate })
            .Select(g => new
            {
                TaxType = g.Key.TaxType,
                PercentageCode = g.Key.PercentageCode,
                Rate = g.Key.Rate,
                TaxableBase = Math.Round(g.Sum(x => x.TaxableBase), 2, MidpointRounding.AwayFromZero),
                Value = Math.Round(g.Sum(x => x.TaxAmount), 2, MidpointRounding.AwayFromZero)
            }).ToList();

        var totalWithoutTax = Math.Round(request.Lines.Sum(l => l.Subtotal), 2, MidpointRounding.AwayFromZero);
        var totalDiscount = Math.Round(request.Lines.Sum(l => l.Discount), 2, MidpointRounding.AwayFromZero);
        var totalTax = Math.Round(taxGroups.Sum(t => t.Value), 2, MidpointRounding.AwayFromZero);
        var totalAmount = Math.Round(totalWithoutTax + totalTax + request.TipAmount, 2, MidpointRounding.AwayFromZero);

        var doc = new XDocument(
            new XDeclaration("1.0", "UTF-8", "yes"),
            new XElement("factura",
                new XAttribute("id", "comprobante"),
                new XAttribute("version", "1.1.0"),

                // infoTributaria
                new XElement("infoTributaria",
                    new XElement("ambiente", ((int)request.Issuer.Environment).ToString()),
                    new XElement("tipoEmision", "1"),
                    new XElement("razonSocial", request.Issuer.SocialReason),
                    new XElement("nombreComercial", request.Issuer.CommercialName ?? request.Issuer.SocialReason),
                    new XElement("ruc", request.Issuer.Ruc),
                    new XElement("claveAcceso", accessKey),
                    new XElement("codDoc", "01"),
                    new XElement("estab", estab),
                    new XElement("ptoEmi", pto),
                    new XElement("secuencial", formattedSequential),
                    new XElement("dirMatriz", request.Issuer.MainAddress),
                    !string.IsNullOrEmpty(request.Issuer.RimpeType) ? new XElement("contribuyenteRimpe", request.Issuer.RimpeType) : null,
                    !string.IsNullOrEmpty(request.Issuer.SpecialResolutionNumber) ? new XElement("resolucion", request.Issuer.SpecialResolutionNumber) : null
                ),

                // infoFactura
                new XElement("infoFactura",
                    new XElement("fechaEmision", dateStr),
                    new XElement("dirEstablecimiento", request.Establishment.Address ?? request.Issuer.MainAddress),
                    new XElement("obligadoContabilidad", request.Issuer.IsObligedToKeepAccounts ? "SI" : "NO"),
                    new XElement("tipoIdentificacionComprador", ((int)request.Customer.IdentificationType).ToString("D2")),
                    new XElement("razonSocialComprador", request.Customer.SocialReason),
                    new XElement("identificacionComprador", request.Customer.IdentificationNumber),
                    new XElement("direccionComprador", request.Customer.Address ?? "Ecuador"),
                    new XElement("totalSinImpuestos", totalWithoutTax.ToString("F2", invCulture)),
                    new XElement("totalDescuento", totalDiscount.ToString("F2", invCulture)),
                    
                    // totalConImpuestos
                    new XElement("totalConImpuestos",
                        taxGroups.Select(tg => new XElement("totalImpuesto",
                            new XElement("codigo", ((int)tg.TaxType).ToString()),
                            new XElement("codigoPorcentaje", tg.PercentageCode),
                            new XElement("baseImponible", tg.TaxableBase.ToString("F2", invCulture)),
                            new XElement("tarifa", tg.Rate.ToString("F0", invCulture)),
                            new XElement("valor", tg.Value.ToString("F2", invCulture))
                        ))
                    ),

                    new XElement("propina", request.TipAmount.ToString("F2", invCulture)),
                    new XElement("importeTotal", totalAmount.ToString("F2", invCulture)),
                    new XElement("moneda", "DOLAR"),

                    // pagos
                    new XElement("pagos",
                        request.Payments.Select(p => new XElement("pago",
                            new XElement("formaPago", ((int)p.PaymentMethod).ToString("D2")),
                            new XElement("total", p.Total.ToString("F2", invCulture)),
                            new XElement("plazo", p.TimeLimit),
                            new XElement("unidadTiempo", p.TimeUnit)
                        ))
                    )
                ),

                // detalles
                new XElement("detalles",
                    request.Lines.Select(line => new XElement("detalle",
                        new XElement("codigoPrincipal", line.ItemCode),
                        !string.IsNullOrEmpty(line.AuxiliaryCode) ? new XElement("codigoAuxiliar", line.AuxiliaryCode) : null,
                        new XElement("descripcion", line.Description),
                        new XElement("cantidad", line.Quantity.ToString("F2", invCulture)),
                        new XElement("precioUnitario", line.UnitPrice.ToString("F4", invCulture)),
                        new XElement("descuento", line.Discount.ToString("F2", invCulture)),
                        new XElement("precioTotalSinImpuesto", line.Subtotal.ToString("F2", invCulture)),
                        new XElement("impuestos",
                            line.Taxes.Select(t => new XElement("impuesto",
                                new XElement("codigo", ((int)t.TaxType).ToString()),
                                new XElement("codigoPorcentaje", t.PercentageCode),
                                new XElement("tarifa", t.Rate.ToString("F0", invCulture)),
                                new XElement("baseImponible", t.TaxableBase.ToString("F2", invCulture)),
                                new XElement("valor", t.TaxAmount.ToString("F2", invCulture))
                            ))
                        )
                    ))
                ),

                // infoAdicional
                (!string.IsNullOrEmpty(request.Customer.Email) || !string.IsNullOrEmpty(request.AdditionalInfo) || request.CustomFields.Any())
                ? new XElement("infoAdicional",
                    !string.IsNullOrEmpty(request.Customer.Email) ? new XElement("campoAdicional", new XAttribute("nombre", "Email"), request.Customer.Email) : null,
                    !string.IsNullOrEmpty(request.Customer.Phone) ? new XElement("campoAdicional", new XAttribute("nombre", "Telefono"), request.Customer.Phone) : null,
                    !string.IsNullOrEmpty(request.AdditionalInfo) ? new XElement("campoAdicional", new XAttribute("nombre", "Nota"), request.AdditionalInfo) : null,
                    request.CustomFields.Select(kv => new XElement("campoAdicional", new XAttribute("nombre", kv.Key), kv.Value))
                  )
                : null
            )
        );

        return doc.ToString(SaveOptions.DisableFormatting | SaveOptions.OmitDuplicateNamespaces);
    }
}
