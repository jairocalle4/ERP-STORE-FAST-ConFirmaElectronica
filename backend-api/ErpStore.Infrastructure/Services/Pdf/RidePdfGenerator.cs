using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ErpStore.Domain.Entities;

namespace ErpStore.Infrastructure.Services.Pdf;

public static class RidePdfGenerator
{
    private static readonly string PrimaryColor = "#0066CC"; // Elegant blue for headers and borders
    private static readonly string TextColor = "#334155";
    private static readonly string BorderColor = "#CBD5E1";

    public static async Task<byte[]> GenerateAsync(Sale sale, CompanySetting company)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        byte[]? logoBytes = null;
        if (!string.IsNullOrEmpty(company.LogoUrl))
        {
            try
            {
                using var client = new HttpClient();
                logoBytes = await client.GetByteArrayAsync(company.LogoUrl);
            }
            catch
            {
                // Ignore if logo fails to load
            }
        }

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(TextColor));

                page.Content().Column(c =>
                {
                    c.Item().Element(el => ComposeHeader(el, sale, company, logoBytes));
                    c.Item().PaddingTop(15).Element(el => ComposeClient(el, sale));
                    c.Item().PaddingTop(15).Element(el => ComposeProductsTable(el, sale));
                    c.Item().PaddingTop(15).Element(el => ComposeTotals(el, sale));
                });

                page.Footer().Element(el => ComposeFooter(el, company));
            });
        });

        return document.GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, Sale sale, CompanySetting company, byte[]? logoBytes)
    {
        container.Row(row =>
        {
            // Izquierda: Logo y datos del emisor
            row.RelativeItem(5).PaddingRight(10).Column(column =>
            {
                if (logoBytes != null)
                {
                    column.Item().Height(80).AlignLeft().Image(logoBytes).FitArea();
                    column.Item().PaddingTop(10);
                }

                column.Item().Text(company.Name ?? "EMPRESA").FontSize(14).Bold().FontColor(PrimaryColor);
                if (!string.IsNullOrEmpty(company.SocialReason))
                {
                    column.Item().Text(company.SocialReason).FontSize(10);
                }
                
                // RUC a la izquierda
                column.Item().PaddingTop(5).Text(t =>
                {
                    t.Span("R.U.C.: ").Bold();
                    t.Span(company.Ruc ?? "");
                });

                if (!string.IsNullOrEmpty(company.Address))
                {
                    column.Item().Text(t =>
                    {
                        t.Span("Dirección: ").Bold();
                        t.Span(company.Address);
                    });
                }
                
                if (!string.IsNullOrEmpty(company.Phone))
                {
                    column.Item().Text(t =>
                    {
                        t.Span("Teléfono: ").Bold();
                        t.Span(company.Phone);
                    });
                }
                
                if (!string.IsNullOrEmpty(company.Email))
                {
                    column.Item().Text(t =>
                    {
                        t.Span("Email: ").Bold();
                        t.Span(company.Email);
                    });
                }

                column.Item().PaddingTop(10).Text("OBLIGADO A LLEVAR CONTABILIDAD: NO").FontSize(9).Bold();
                
                if (company.TributaryRegime != null && company.TributaryRegime.Contains("RIMPE"))
                {
                    column.Item().PaddingTop(4).Text("CONTRIBUYENTE RÉGIMEN RIMPE").FontSize(9).Bold().FontColor(PrimaryColor);
                }
            });

            // Derecha: Datos de la Factura (Recuadro)
            row.RelativeItem(6).Border(1).BorderColor(BorderColor).Padding(10).Column(column =>
            {
                column.Item().Text("F A C T U R A").FontSize(16).Bold().FontColor(PrimaryColor);
                column.Item().PaddingTop(5).Text($"No. {sale.NoteNumber}").FontSize(12);
                
                column.Item().PaddingTop(10).Text("NÚMERO DE AUTORIZACIÓN").FontSize(9).Bold();
                column.Item().Text(sale.AuthorizationNumber ?? "PENDIENTE").FontSize(10);

                column.Item().PaddingTop(10).Text("FECHA Y HORA DE AUTORIZACIÓN").FontSize(9).Bold();
                column.Item().Text(sale.AuthorizationDate?.ToString("dd/MM/yyyy HH:mm:ss") ?? "PENDIENTE").FontSize(10);

                var ambienteText = company.SriEnvironment == "1" ? "PRUEBAS" : "PRODUCCIÓN";
                column.Item().PaddingTop(10).Row(r =>
                {
                    r.RelativeItem().Text("AMBIENTE: " + ambienteText).FontSize(9).Bold();
                    r.RelativeItem().Text("EMISIÓN: NORMAL").FontSize(9).Bold();
                });

                column.Item().PaddingTop(10).Text("CLAVE DE ACCESO").FontSize(9).Bold();
                if (!string.IsNullOrEmpty(sale.AccessKey))
                {
                    column.Item().Text(sale.AccessKey).FontFamily("Courier").FontSize(10);
                }
            });
        });
    }

    private static void ComposeClient(IContainer container, Sale sale)
    {
        container.Border(1).BorderColor(BorderColor).Background("#F8FAFC").Padding(10).Column(column =>
        {
            column.Item().PaddingBottom(5).Text("DATOS DEL COMPRADOR / RECEPTOR").FontSize(10).Bold().FontColor(PrimaryColor);
            
            column.Item().Row(row =>
            {
                row.RelativeItem().Text(t =>
                {
                    t.Span("Razón Social / Nombres: ").Bold();
                    t.Span(sale.Client?.Name ?? "Consumidor Final");
                });
                
                row.ConstantItem(150).Text(t =>
                {
                    t.Span("RUC/CI: ").Bold();
                    t.Span(sale.Client?.CedulaRuc ?? "9999999999999");
                });
            });

            column.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Text(t =>
                {
                    t.Span("Fecha Emisión: ").Bold();
                    t.Span(sale.Date.ToString("dd/MM/yyyy"));
                });

                if (!string.IsNullOrEmpty(sale.Client?.Address))
                {
                    row.RelativeItem(2).Text(t =>
                    {
                        t.Span("Dirección: ").Bold();
                        t.Span(sale.Client.Address);
                    });
                }
            });
        });
    }

    private static void ComposeProductsTable(IContainer container, Sale sale)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(60); // Codigo
                columns.ConstantColumn(50); // Cantidad
                columns.RelativeColumn();   // Descripcion
                columns.ConstantColumn(80); // Precio Unit
                columns.ConstantColumn(70); // Descuento
                columns.ConstantColumn(80); // Total
            });

            table.Header(header =>
            {
                header.Cell().Background(PrimaryColor).Padding(5).Text("Código").FontColor(Colors.White).Bold();
                header.Cell().Background(PrimaryColor).Padding(5).AlignRight().Text("Cant.").FontColor(Colors.White).Bold();
                header.Cell().Background(PrimaryColor).Padding(5).Text("Descripción").FontColor(Colors.White).Bold();
                header.Cell().Background(PrimaryColor).Padding(5).AlignRight().Text("Precio Unit.").FontColor(Colors.White).Bold();
                header.Cell().Background(PrimaryColor).Padding(5).AlignRight().Text("Descuento").FontColor(Colors.White).Bold();
                header.Cell().Background(PrimaryColor).Padding(5).AlignRight().Text("Precio Total").FontColor(Colors.White).Bold();
            });

            if (sale.SaleDetails != null)
            {
                foreach (var item in sale.SaleDetails)
                {
                    table.Cell().BorderBottom(1).BorderColor(BorderColor).Padding(5).Text(item.Product?.Id.ToString() ?? "-");
                    table.Cell().BorderBottom(1).BorderColor(BorderColor).Padding(5).AlignRight().Text(item.Quantity.ToString());
                    table.Cell().BorderBottom(1).BorderColor(BorderColor).Padding(5).Text(item.Product?.Name ?? "Producto");
                    table.Cell().BorderBottom(1).BorderColor(BorderColor).Padding(5).AlignRight().Text($"${item.UnitPrice:F2}");
                    table.Cell().BorderBottom(1).BorderColor(BorderColor).Padding(5).AlignRight().Text($"$0.00"); // Asumiendo 0 descuento
                    table.Cell().BorderBottom(1).BorderColor(BorderColor).Padding(5).AlignRight().Text($"${item.Subtotal:F2}");
                }
            }
        });
    }

    private static void ComposeTotals(IContainer container, Sale sale)
    {
        container.Row(row =>
        {
            row.RelativeItem().PaddingRight(20).Column(column =>
            {
                if (!string.IsNullOrEmpty(sale.Client?.Email))
                {
                    column.Item().Border(1).BorderColor(BorderColor).Padding(8).Text(t =>
                    {
                        t.Span("Email Cliente: ").Bold();
                        t.Span(sale.Client.Email);
                    });
                }
                
                column.Item().PaddingTop(10).Text("Información Adicional").FontSize(11).Bold().FontColor(PrimaryColor);
                column.Item().Text("Gracias por su compra.").FontSize(9).Italic();
            });

            row.ConstantItem(250).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn();
                    columns.ConstantColumn(80);
                });

                decimal subtotal = sale.SaleDetails?.Sum(d => d.Subtotal) ?? 0;
                decimal iva = sale.Total - subtotal;
                decimal subtotalIva = iva > 0 ? subtotal : 0;
                decimal subtotal0 = iva == 0 ? subtotal : 0;
                decimal ivaRate = iva > 0 ? 15 : 0; // Para visualizacion

                void DrawTotalRow(string label, string value, bool isTotal = false)
                {
                    table.Cell().Element(c =>
                    {
                        var cont = c.Border(1).BorderColor(BorderColor).Padding(5);
                        if (isTotal) cont = cont.Background(PrimaryColor);
                        cont.Text(label).Bold().FontColor(isTotal ? Colors.White : TextColor);
                    });
                    
                    table.Cell().Element(c =>
                    {
                        var cont = c.Border(1).BorderColor(BorderColor).Padding(5).AlignRight();
                        if (isTotal) cont = cont.Background(PrimaryColor);
                        cont.Text(value).Bold().FontColor(isTotal ? Colors.White : TextColor);
                    });
                }

                DrawTotalRow($"Subtotal {ivaRate}%", $"${subtotalIva:F2}");
                DrawTotalRow("Subtotal 0%", $"${subtotal0:F2}");
                DrawTotalRow("Subtotal No Objeto de IVA", "$0.00");
                DrawTotalRow("Subtotal Exento de IVA", "$0.00");
                DrawTotalRow("Subtotal sin Impuestos", $"${subtotal:F2}");
                DrawTotalRow("Total Descuento", "$0.00");
                DrawTotalRow("ICE", "$0.00");
                DrawTotalRow($"IVA {ivaRate}%", $"${iva:F2}");
                DrawTotalRow("VALOR TOTAL", $"${sale.Total:F2}", true);
            });
        });
    }

    private static void ComposeFooter(IContainer container, CompanySetting company)
    {
        container.Column(c => {
            c.Item().AlignCenter().Text("✓ DOCUMENTO AUTORIZADO POR EL SERVICIO DE RENTAS INTERNAS — www.sri.gob.ec")
             .FontSize(8).Bold().FontColor(PrimaryColor);

            if (!string.IsNullOrEmpty(company.LegalMessage))
            {
                c.Item().AlignCenter().Text(company.LegalMessage).FontSize(8);
            }
            else if (company.TributaryRegime != null && company.TributaryRegime.Contains("RIMPE"))
            {
                c.Item().AlignCenter().Text("Contribuyente RIMPE – Negocio Popular | Régimen Simplificado").FontSize(8);
            }

            var dateStr = DateTime.Now.ToString("dd/MM/yyyy, h:mm:ss t. m.");
            c.Item().AlignCenter().Text($"Generado: {dateStr} — ERP-STORE-FAST").FontSize(8).FontColor(Colors.Grey.Medium);
            
            c.Item().PaddingTop(5).AlignCenter().Text(x =>
            {
                x.Span("Página ");
                x.CurrentPageNumber();
                x.Span(" de ");
                x.TotalPages();
            });
        });
    }
}
