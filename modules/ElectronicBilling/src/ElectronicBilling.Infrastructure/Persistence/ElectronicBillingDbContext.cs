using ElectronicBilling.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectronicBilling.Infrastructure.Persistence;

public class ElectronicBillingDbContext : DbContext
{
    public string? CurrentTenantId { get; set; }

    public ElectronicBillingDbContext(DbContextOptions<ElectronicBillingDbContext> options)
        : base(options)
    {
    }

    public DbSet<ElectronicDocument> ElectronicDocuments => Set<ElectronicDocument>();
    public DbSet<TenantSetting> TenantSettings => Set<TenantSetting>();
    public DbSet<EmissionPointSequence> EmissionPointSequences => Set<EmissionPointSequence>();
    public DbSet<ElectronicDocumentAudit> ElectronicDocumentAudits => Set<ElectronicDocumentAudit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ElectronicDocument configuration
        modelBuilder.Entity<ElectronicDocument>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.AccessKey }).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.Establishment, e.EmissionPoint, e.Sequential, e.DocumentType }).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.IdempotencyKey });
            entity.HasIndex(e => new { e.TenantId, e.SourceSystem, e.SourceEntityType, e.SourceEntityId });

            entity.HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        });

        // TenantSetting configuration
        modelBuilder.Entity<TenantSetting>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TenantId).IsUnique();
            entity.HasIndex(e => e.Ruc);

            entity.HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        });

        // EmissionPointSequence configuration
        modelBuilder.Entity<EmissionPointSequence>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.Establishment, e.EmissionPoint, e.DocumentType }).IsUnique();

            entity.HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        });

        // ElectronicDocumentAudit configuration
        modelBuilder.Entity<ElectronicDocumentAudit>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.DocumentId });

            entity.HasQueryFilter(e => CurrentTenantId == null || e.TenantId == CurrentTenantId);
        });
    }
}
