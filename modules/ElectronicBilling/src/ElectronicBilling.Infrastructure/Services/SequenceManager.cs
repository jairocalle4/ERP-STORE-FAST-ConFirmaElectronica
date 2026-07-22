using ElectronicBilling.Core.Entities;
using ElectronicBilling.Core.Enums;
using ElectronicBilling.Core.Interfaces;
using ElectronicBilling.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ElectronicBilling.Infrastructure.Services;

public class SequenceManager : ISequenceManager
{
    private readonly ElectronicBillingDbContext _dbContext;

    public SequenceManager(ElectronicBillingDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<int> GetNextSequenceAsync(string tenantId, string establishment, string emissionPoint, DocumentType documentType)
    {
        var estab = (establishment ?? "001").PadLeft(3, '0');
        var pto = (emissionPoint ?? "001").PadLeft(3, '0');

        var executionStrategy = _dbContext.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            EmissionPointSequence? seqRecord = null;

            if (_dbContext.Database.IsNpgsql())
            {
                // Lock row FOR UPDATE in PostgreSQL to prevent concurrent sequence collisions
                seqRecord = await _dbContext.EmissionPointSequences
                    .FromSqlRaw(
                        "SELECT * FROM \"EmissionPointSequences\" WHERE \"TenantId\" = {0} AND \"Establishment\" = {1} AND \"EmissionPoint\" = {2} AND \"DocumentType\" = {3} FOR UPDATE",
                        tenantId, estab, pto, (int)documentType)
                    .FirstOrDefaultAsync();
            }
            else
            {
                seqRecord = await _dbContext.EmissionPointSequences
                    .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Establishment == estab && s.EmissionPoint == pto && s.DocumentType == documentType);
            }

            if (seqRecord == null)
            {
                seqRecord = new EmissionPointSequence
                {
                    TenantId = tenantId,
                    Establishment = estab,
                    EmissionPoint = pto,
                    DocumentType = documentType,
                    CurrentSequence = 1,
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.EmissionPointSequences.Add(seqRecord);
                await _dbContext.SaveChangesAsync();

                var reservedSeq = seqRecord.CurrentSequence;
                seqRecord.CurrentSequence++;
                seqRecord.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return reservedSeq;
            }
            else
            {
                var reservedSeq = seqRecord.CurrentSequence;
                seqRecord.CurrentSequence++;
                seqRecord.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return reservedSeq;
            }
        });
    }
}
