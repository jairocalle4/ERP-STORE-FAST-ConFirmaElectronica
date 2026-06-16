using System;
using System.Linq;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ErpStore.Domain.Entities;

namespace ErpStore.Infrastructure.Services.Pdf;

public static class RidePdfGenerator
{
    public static byte[] Generate(Sale sale, CompanySetting company)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

                page.Header().Element(c => ComposeHeader(c, sale, company));
                page.Content().Element(c => ComposeContent(c, sale));
                page.Footer().Element(ComposeFooter);
            });
        });

        return document.GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, Sale sale, CompanySetting company)
    {
        container.Row(row =>
        {
            // Emisor info
            row.RelativeItem().Column(column =>
            {
                column.Item().Text(company.Name ?? "EMPRESA").FontSize(16).Bold();
                column.Item().Text($"RUC: {company.Ruc}");
                column.Item().Text($"Dirección: {company.Address}");
                column.Item().Text("Contribuyente Régimen RIMPE - Negocio Popular");
                column.Item().Text($"Obligado a llevar contabilidad: NO");
            });

            // Factura info
            row.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten1).Padding(5).Column(column =>
            {
                column.Item().Text("FACTURA").FontSize(14).Bold();
                column.Item().Text($"No. {sale.NoteNumber}");
                column.Item().Text($"Fecha Autorización: {sale.AuthorizationDate?.ToString("dd/MM/yyyy HH:mm:ss")}");
                var ambienteText = company.SriEnvironment == "1" ? "PRUEBAS" : "PRODUCCIÓN";
                column.Item().Text($"AMBIENTE: {ambienteText}");
                column.Item().Text("EMISIÓN: NORMAL");
                column.Item().PaddingTop(5).Text("CLAVE DE ACCESO:").Bold();
                column.Item().Text(sale.AccessKey ?? "").FontSize(8);
                
                if (!string.IsNullOrEmpty(sale.AccessKey))
                {
                    column.Item().Text(sale.AccessKey).FontFamily("Courier New").FontSize(10);
                }
            });
        });
    }

    private static void ComposeContent(IContainer container, Sale sale)
    {
        container.PaddingVertical(1, Unit.Centimetre).Column(column =>
        {
            // Cliente
            column.Item().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingBottom(5).Row(row =>
            {
                row.RelativeItem().Text($"Razón Social / Nombres: {sale.Client?.Name}");
                row.RelativeItem().Text($"Identificación: {sale.Client?.CedulaRuc}");
                row.RelativeItem().Text($"Fecha Emisión: {sale.Date.ToString("dd/MM/yyyy")}");
            });

            column.Item().PaddingTop(10).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(50);
                    columns.RelativeColumn();
                    columns.ConstantColumn(80);
                    columns.ConstantColumn(80);
                });

                table.Header(header =>
                {
                    header.Cell().BorderBottom(1).Text("Cant.");
                    header.Cell().BorderBottom(1).Text("Descripción");
                    header.Cell().BorderBottom(1).AlignRight().Text("Precio Unitario");
                    header.Cell().BorderBottom(1).AlignRight().Text("Precio Total");
                });

                if (sale.SaleDetails != null)
                {
                    foreach (var item in sale.SaleDetails)
                    {
                        table.Cell().Text(item.Quantity.ToString());
                        table.Cell().Text(item.Product?.Name ?? "Producto");
                        table.Cell().AlignRight().Text($"${item.UnitPrice:F2}");
                        table.Cell().AlignRight().Text($"${item.Subtotal:F2}");
                    }
                }
            });

            column.Item().PaddingTop(15).AlignRight().Text($"Valor Total: ${sale.Total:F2}").FontSize(14).Bold();
        });
    }

    private static void ComposeFooter(IContainer container)
    {
        container.AlignCenter().Text(x =>
        {
            x.Span("Página ");
            x.CurrentPageNumber();
            x.Span(" de ");
            x.TotalPages();
        });
    }
}
