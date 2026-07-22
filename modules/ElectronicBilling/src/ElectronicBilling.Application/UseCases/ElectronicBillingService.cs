using ElectronicBilling.Application.Idempotency;
using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Entities;
using ElectronicBilling.Core.Enums;
using ElectronicBilling.Core.Interfaces;
using ElectronicBilling.Core.Models;
using ElectronicBilling.Infrastructure.Persistence;
using ElectronicBilling.Sri;
using Microsoft.EntityFrameworkCore;

namespace ElectronicBilling.Application.UseCases;

public class ElectronicBillingService : IElectronicBillingService
{
    private readonly ElectronicBillingDbContext _dbContext;
    private readonly ISequenceManager _sequenceManager;
    private readonly ISriXmlSigner _signer;
    private readonly ISriXmlSignatureValidator _validator;
    private readonly ISriSoapClient _soapClient;
    private readonly IRideGenerator _rideGenerator;
    private readonly IEmailNotifier _emailNotifier;
    private readonly ICertificateManager _certManager;
    private readonly IdempotencyChecker _idempotencyChecker;

    public ElectronicBillingService(
        ElectronicBillingDbContext dbContext,
        ISequenceManager sequenceManager,
        ISriXmlSigner signer,
        ISriXmlSignatureValidator validator,
        ISriSoapClient soapClient,
        IRideGenerator rideGenerator,
        IEmailNotifier emailNotifier,
        ICertificateManager certManager)
    {
        _dbContext = dbContext;
        _sequenceManager = sequenceManager;
        _signer = signer;
        _validator = validator;
        _soapClient = soapClient;
        _rideGenerator = rideGenerator;
        _emailNotifier = emailNotifier;
        _certManager = certManager;
        _idempotencyChecker = new IdempotencyChecker(dbContext);
    }

    public async Task<AuthorizedElectronicDocument> EmitInvoiceAsync(ElectronicInvoiceRequest request)
    {
        // 1. Idempotency Check
        var existingDoc = await _idempotencyChecker.FindExistingDocumentAsync(request);
        if (existingDoc != null && (existingDoc.Status == ElectronicStatus.Authorized || existingDoc.Status == ElectronicStatus.Sent))
        {
            return MapToAuthorizedDocument(existingDoc, request.Issuer, request.Customer, request.Lines, request.Payments);
        }

        // 2. Fetch Tenant Settings & Certificates
        var tenantSetting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(t => t.TenantId == request.TenantId);

        if (tenantSetting == null || tenantSetting.EncryptedSignatureFile == null || string.IsNullOrEmpty(tenantSetting.EncryptedSignaturePassword))
        {
            return new AuthorizedElectronicDocument
            {
                Success = false,
                Status = ElectronicStatus.Error,
                ErrorMessage = $"Configuración o firma electrónica .p12 no encontrada para la empresa (TenantId: {request.TenantId})."
            };
        }

        byte[] rawP12;
        string rawPassword;
        try
        {
            (rawP12, rawPassword) = _certManager.UnprotectCertificate(tenantSetting.EncryptedSignatureFile, tenantSetting.EncryptedSignaturePassword);
        }
        catch (Exception ex)
        {
            return new AuthorizedElectronicDocument
            {
                Success = false,
                Status = ElectronicStatus.Error,
                ErrorMessage = $"Error al descifrar el certificado .p12: {ex.Message}"
            };
        }

        // 3. Transactional Sequence Reservation (SELECT ... FOR UPDATE)
        int seqNum;
        if (!string.IsNullOrEmpty(request.Sequential) && int.TryParse(request.Sequential, out var parsedSeq))
        {
            seqNum = parsedSeq;
        }
        else
        {
            seqNum = await _sequenceManager.GetNextSequenceAsync(request.TenantId, request.Establishment.Code, request.Establishment.EmissionPointCode, DocumentType.Invoice);
        }
        var formattedSeq = seqNum.ToString("D9");
        var noteNumber = $"{request.Establishment.Code.PadLeft(3, '0')}-{request.Establishment.EmissionPointCode.PadLeft(3, '0')}-{formattedSeq}";

        // 4. Generate Access Key
        var accessKey = AccessKeyGenerator.GenerateAccessKey(
            request.EmissionDate,
            DocumentType.Invoice,
            request.Issuer.Ruc,
            request.Issuer.Environment,
            request.Establishment.Code,
            request.Establishment.EmissionPointCode,
            formattedSeq);

        // 5. Build XML
        var xmlContent = SriXmlBuilder.BuildInvoiceXml(request, accessKey, formattedSeq);

        // 6. Sign XML (XAdES-BES)
        string signedXml;
        try
        {
            signedXml = _signer.SignXml(xmlContent, rawP12, rawPassword);
        }
        catch (Exception ex)
        {
            return new AuthorizedElectronicDocument
            {
                Success = false,
                Status = ElectronicStatus.Error,
                ErrorMessage = $"Error al firmar el XML con XAdES-BES: {ex.Message}"
            };
        }

        // 7. Local Signature Validation Audit
        var signatureValidation = _validator.ValidateSignature(signedXml);
        if (!signatureValidation.IsValid)
        {
            return new AuthorizedElectronicDocument
            {
                Success = false,
                Status = ElectronicStatus.Error,
                ErrorMessage = $"Validación local de firma fallida: {signatureValidation.ErrorMessage}"
            };
        }

        // 8. Save or Update ElectronicDocument Entity
        var entity = existingDoc ?? new ElectronicDocument
        {
            TenantId = request.TenantId,
            AccessKey = accessKey,
            Establishment = request.Establishment.Code,
            EmissionPoint = request.Establishment.EmissionPointCode,
            Sequential = formattedSeq,
            NoteNumber = noteNumber,
            EmissionDate = request.EmissionDate,
            DocumentType = DocumentType.Invoice,
            CustomerCedulaRuc = request.Customer.IdentificationNumber,
            CustomerName = request.Customer.SocialReason,
            CustomerEmail = request.Customer.Email,
            SourceSystem = request.SourceSystem,
            SourceEntityType = request.SourceEntityType,
            SourceEntityId = request.SourceEntityId,
            IdempotencyKey = request.IdempotencyKey
        };

        entity.XmlContent = xmlContent;
        entity.SignedXmlContent = signedXml;
        entity.Status = ElectronicStatus.Signed;
        entity.SubtotalWithoutTax = Math.Round(request.Lines.Sum(l => l.Subtotal), 2);
        entity.TotalDiscount = Math.Round(request.Lines.Sum(l => l.Discount), 2);
        entity.TotalTax = Math.Round(request.Lines.SelectMany(l => l.Taxes).Sum(t => t.TaxAmount), 2);
        entity.TotalAmount = entity.SubtotalWithoutTax + entity.TotalTax;

        if (existingDoc == null) _dbContext.ElectronicDocuments.Add(entity);
        await _dbContext.SaveChangesAsync();

        // 9. Send SOAP Reception
        var receptionResult = await _soapClient.SendForReceptionAsync(signedXml, request.Issuer.Environment);
        if (!receptionResult.Received && !receptionResult.Messages.Any(m => m.Message?.Contains("CLAVE ACCESO REGISTRADA", StringComparison.OrdinalIgnoreCase) == true))
        {
            entity.Status = ElectronicStatus.Error;
            entity.ErrorMessage = string.Join("; ", receptionResult.Messages.Select(m => $"{m.Identifier}: {m.Message}"));
            await _dbContext.SaveChangesAsync();

            return new AuthorizedElectronicDocument
            {
                Success = false,
                Status = ElectronicStatus.Error,
                AccessKey = accessKey,
                ErrorMessage = entity.ErrorMessage,
                Messages = receptionResult.Messages
            };
        }

        // 10. Query Authorization (Handles immediate authorization & fallback for CLAVE ACCESO REGISTRADA)
        var authResult = await _soapClient.QueryAuthorizationAsync(accessKey, request.Issuer.Environment);
        if (authResult.Authorized)
        {
            entity.Status = ElectronicStatus.Authorized;
            entity.AuthorizationNumber = authResult.AuthorizationNumber ?? accessKey;
            entity.AuthorizationDate = authResult.AuthorizationDate ?? DateTime.UtcNow;
            entity.XmlContent = authResult.AuthorizedXml ?? signedXml;
            entity.ErrorMessage = null;
            await _dbContext.SaveChangesAsync();

            var responseDoc = MapToAuthorizedDocument(entity, request.Issuer, request.Customer, request.Lines, request.Payments);

            // Generate RIDE PDF
            try
            {
                responseDoc.PdfRideBytes = _rideGenerator.GenerateRidePdf(responseDoc, request.Issuer, request.Customer, request.Lines, request.Payments, tenantSetting.LogoBytes);
            }
            catch { /* Ignore RIDE PDF generation errors if fallback */ }

            // Email Notification
            if (!string.IsNullOrEmpty(request.Customer.Email))
            {
                var emailRes = await _emailNotifier.SendDocumentEmailAsync(
                    tenantSetting,
                    request.Customer.Email,
                    $"Factura Electrónica {noteNumber} - {request.Issuer.SocialReason}",
                    $"Estimado/a {request.Customer.SocialReason}, adjunto su comprobante electrónico.",
                    $"Factura_{noteNumber}.xml",
                    entity.XmlContent,
                    responseDoc.PdfRideBytes ?? Array.Empty<byte>());

                responseDoc.EmailSent = emailRes.Success;
                responseDoc.EmailError = emailRes.Error;
            }

            return responseDoc;
        }

        entity.Status = ElectronicStatus.NotAuthorized;
        entity.ErrorMessage = string.Join("; ", authResult.Messages.Select(m => $"{m.Identifier}: {m.Message}"));
        await _dbContext.SaveChangesAsync();

        return new AuthorizedElectronicDocument
        {
            Success = false,
            Status = ElectronicStatus.NotAuthorized,
            AccessKey = accessKey,
            ErrorMessage = entity.ErrorMessage,
            Messages = authResult.Messages
        };
    }

    public async Task<AuthorizedElectronicDocument> RetryEmissionAsync(string tenantId, Guid documentId)
    {
        var doc = await _dbContext.ElectronicDocuments
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == documentId);

        if (doc == null)
        {
            return new AuthorizedElectronicDocument { Success = false, Status = ElectronicStatus.Error, ErrorMessage = "Documento no encontrado." };
        }

        var tenantSetting = await _dbContext.TenantSettings.FirstOrDefaultAsync(t => t.TenantId == tenantId);
        if (tenantSetting == null)
        {
            return new AuthorizedElectronicDocument { Success = false, Status = ElectronicStatus.Error, ErrorMessage = "Configuración de empresa no encontrada." };
        }

        var authResult = await _soapClient.QueryAuthorizationAsync(doc.AccessKey, tenantSetting.SriEnvironment);
        if (authResult.Authorized)
        {
            doc.Status = ElectronicStatus.Authorized;
            doc.AuthorizationNumber = authResult.AuthorizationNumber ?? doc.AccessKey;
            doc.AuthorizationDate = authResult.AuthorizationDate ?? DateTime.UtcNow;
            if (!string.IsNullOrEmpty(authResult.AuthorizedXml)) doc.XmlContent = authResult.AuthorizedXml;
            doc.ErrorMessage = null;
            await _dbContext.SaveChangesAsync();
        }

        return new AuthorizedElectronicDocument
        {
            Success = doc.Status == ElectronicStatus.Authorized,
            Status = doc.Status,
            AccessKey = doc.AccessKey,
            AuthorizationNumber = doc.AuthorizationNumber,
            AuthorizationDate = doc.AuthorizationDate,
            XmlContent = doc.XmlContent,
            ErrorMessage = doc.ErrorMessage
        };
    }

    public async Task<AuthorizedElectronicDocument?> GetDocumentStatusAsync(string tenantId, string accessKey)
    {
        var doc = await _dbContext.ElectronicDocuments
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.AccessKey == accessKey);

        if (doc == null) return null;

        return new AuthorizedElectronicDocument
        {
            Success = doc.Status == ElectronicStatus.Authorized,
            Status = doc.Status,
            AccessKey = doc.AccessKey,
            AuthorizationNumber = doc.AuthorizationNumber,
            AuthorizationDate = doc.AuthorizationDate,
            XmlContent = doc.XmlContent,
            ErrorMessage = doc.ErrorMessage
        };
    }

    public async Task<byte[]> GetRidePdfAsync(string tenantId, string accessKey)
    {
        var doc = await GetDocumentStatusAsync(tenantId, accessKey);
        if (doc == null) throw new InvalidOperationException("Documento no encontrado.");

        var tenant = await _dbContext.TenantSettings.FirstOrDefaultAsync(t => t.TenantId == tenantId);
        var issuer = new IssuerData
        {
            Ruc = tenant?.Ruc ?? "0000000000001",
            SocialReason = tenant?.SocialReason ?? "Empresa",
            MainAddress = tenant?.MainAddress ?? "Ecuador"
        };
        var customer = new CustomerData
        {
            IdentificationType = IdentificationType.FinalConsumer,
            IdentificationNumber = "9999999999999",
            SocialReason = "Consumidor Final",
            Address = "Ecuador"
        };

        return _rideGenerator.GenerateRidePdf(doc, issuer, customer, new(), new(), tenant?.LogoBytes);
    }

    public async Task<string> GetDocumentXmlAsync(string tenantId, string accessKey)
    {
        var doc = await _dbContext.ElectronicDocuments
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.AccessKey == accessKey);

        return doc?.XmlContent ?? doc?.SignedXmlContent ?? string.Empty;
    }

    public async Task<bool> ResendEmailAsync(string tenantId, string accessKey, string targetEmail)
    {
        var doc = await _dbContext.ElectronicDocuments
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.AccessKey == accessKey);
        var tenant = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(t => t.TenantId == tenantId);

        if (doc == null || tenant == null || string.IsNullOrEmpty(doc.XmlContent)) return false;

        var pdfBytes = await GetRidePdfAsync(tenantId, accessKey);

        var emailRes = await _emailNotifier.SendDocumentEmailAsync(
            tenant,
            targetEmail,
            $"Factura Electrónica {doc.NoteNumber} - {tenant.SocialReason}",
            $"Estimado/a {doc.CustomerName}, adjunto su comprobante electrónico.",
            $"Factura_{doc.NoteNumber}.xml",
            doc.XmlContent,
            pdfBytes);

        return emailRes.Success;
    }

    private static AuthorizedElectronicDocument MapToAuthorizedDocument(ElectronicDocument doc, IssuerData issuer, CustomerData customer, List<InvoiceLine> lines, List<PaymentDetail> payments)
    {
        return new AuthorizedElectronicDocument
        {
            Success = doc.Status == ElectronicStatus.Authorized,
            Status = doc.Status,
            AccessKey = doc.AccessKey,
            AuthorizationNumber = doc.AuthorizationNumber,
            AuthorizationDate = doc.AuthorizationDate,
            XmlContent = doc.XmlContent,
            SignedXmlContent = doc.SignedXmlContent,
            ErrorMessage = doc.ErrorMessage
        };
    }
}
