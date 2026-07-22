using System.Net;
using System.Net.Mail;
using System.Text;
using ElectronicBilling.Core.Entities;
using ElectronicBilling.Core.Interfaces;

namespace ElectronicBilling.Infrastructure.Notifiers;

public class EmailNotifier : IEmailNotifier
{
    public async Task<(bool Success, string? Error)> SendDocumentEmailAsync(TenantSetting tenant, string toEmail, string subject, string body, string xmlFilename, string xmlContent, byte[] ridePdfBytes)
    {
        if (string.IsNullOrEmpty(tenant.SmtpHost) || string.IsNullOrEmpty(toEmail))
        {
            return (false, "Configuración SMTP o correo de destino no disponible.");
        }

        try
        {
            using var message = new MailMessage();
            message.From = new MailAddress(tenant.SmtpSenderEmail ?? tenant.SmtpUser ?? "no-reply@facturacion.com", tenant.SocialReason);
            message.To.Add(toEmail);
            message.Subject = subject;
            message.Body = body;
            message.IsBodyHtml = true;

            if (!string.IsNullOrEmpty(xmlContent))
            {
                var xmlBytes = Encoding.UTF8.GetBytes(xmlContent);
                message.Attachments.Add(new Attachment(new MemoryStream(xmlBytes), xmlFilename, "application/xml"));
            }

            if (ridePdfBytes != null && ridePdfBytes.Length > 0)
            {
                var pdfFilename = xmlFilename.Replace(".xml", ".pdf", StringComparison.OrdinalIgnoreCase);
                message.Attachments.Add(new Attachment(new MemoryStream(ridePdfBytes), pdfFilename, "application/pdf"));
            }

            using var client = new SmtpClient(tenant.SmtpHost, tenant.SmtpPort)
            {
                Credentials = new NetworkCredential(tenant.SmtpUser, tenant.SmtpPassword),
                EnableSsl = tenant.SmtpEnableSsl
            };

            await client.SendMailAsync(message);
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, $"Error enviando correo: {ex.Message}");
        }
    }
}
