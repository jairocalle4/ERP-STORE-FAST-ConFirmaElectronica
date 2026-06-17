using System;
using System.IO;
using System.Threading.Tasks;
using ErpStore.Domain.Entities;
using ErpStore.Infrastructure.Services.Pdf;
using System.Collections.Generic;

class Program
{
    static async Task Main()
    {
        var company = new CompanySetting { Name = "Test Company", Ruc = "1234567890001", SriEnvironment = "1", TributaryRegime = "RIMPE", LogoUrl = "" };
        var sale = new Sale { Id = 1, NoteNumber = "001-001-000000001", Total = 100, Date = DateTime.Now, Client = new Client { Name = "Juan", CedulaRuc = "0999999999" }, SaleDetails = new List<SaleDetail>() };
        try {
            var pdfBytes = await RidePdfGenerator.GenerateAsync(sale, company);
            File.WriteAllBytes("test.pdf", pdfBytes);
            Console.WriteLine("SUCCESS: test.pdf generated, size=" + pdfBytes.Length);
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.ToString());
        }
    }
}
