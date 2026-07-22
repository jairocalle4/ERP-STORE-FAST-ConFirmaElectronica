using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Entities;
using ElectronicBilling.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ElectronicBilling.Application.Idempotency;

public class IdempotencyChecker
{
    private readonly ElectronicBillingDbContext _dbContext;

    public IdempotencyChecker(ElectronicBillingDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ElectronicDocument?> FindExistingDocumentAsync(ElectronicInvoiceRequest request)
    {
        if (!string.IsNullOrEmpty(request.IdempotencyKey))
        {
            var docByIdempotency = await _dbContext.ElectronicDocuments
                .FirstOrDefaultAsync(d => d.TenantId == request.TenantId && d.IdempotencyKey == request.IdempotencyKey);
            if (docByIdempotency != null) return docByIdempotency;
        }

        if (!string.IsNullOrEmpty(request.SourceSystem) && !string.IsNullOrEmpty(request.SourceEntityType) && !string.IsNullOrEmpty(request.SourceEntityId))
        {
            var docBySource = await _dbContext.ElectronicDocuments
                .FirstOrDefaultAsync(d => d.TenantId == request.TenantId &&
                                          d.SourceSystem == request.SourceSystem &&
                                          d.SourceEntityType == request.SourceEntityType &&
                                          d.SourceEntityId == request.SourceEntityId);
            if (docBySource != null) return docBySource;
        }

        return null;
    }
}
