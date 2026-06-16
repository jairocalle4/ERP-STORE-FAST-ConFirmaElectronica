namespace ErpStore.Application.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body, IEnumerable<(string Filename, byte[] Content, string ContentType)> attachments = null);
    Task ProcessLowStockAlertsAsync();
}
