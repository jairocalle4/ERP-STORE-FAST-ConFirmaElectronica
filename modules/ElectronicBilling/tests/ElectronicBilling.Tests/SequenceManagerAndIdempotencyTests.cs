using ElectronicBilling.Application.Idempotency;
using ElectronicBilling.Core.Contracts;
using ElectronicBilling.Core.Entities;
using ElectronicBilling.Core.Enums;
using ElectronicBilling.Infrastructure.Persistence;
using ElectronicBilling.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace ElectronicBilling.Tests;

public class SequenceManagerAndIdempotencyTests
{
    [Fact]
    public async Task GetNextSequenceAsync_ShouldIncrementSequentiallyForTenant()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<ElectronicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: "Test_Seq_Db_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        using var dbContext = new ElectronicBillingDbContext(options);
        var sequenceManager = new SequenceManager(dbContext);

        // Act
        var seq1 = await sequenceManager.GetNextSequenceAsync("tenant_a", "001", "001", DocumentType.Invoice);
        var seq2 = await sequenceManager.GetNextSequenceAsync("tenant_a", "001", "001", DocumentType.Invoice);

        // Assert
        Assert.Equal(1, seq1);
        Assert.Equal(2, seq2);
    }

    [Fact]
    public async Task MultiTenantIsolation_ShouldKeepSequentialsAndDocumentsSeparate()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<ElectronicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: "Test_MultiTenant_Db_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        using var dbContext = new ElectronicBillingDbContext(options);
        var sequenceManager = new SequenceManager(dbContext);

        // Act
        var seqTenantA = await sequenceManager.GetNextSequenceAsync("tenant_A", "001", "001", DocumentType.Invoice);
        var seqTenantB = await sequenceManager.GetNextSequenceAsync("tenant_B", "001", "001", DocumentType.Invoice);

        // Assert - Both tenants start sequence at 1 independently
        Assert.Equal(1, seqTenantA);
        Assert.Equal(1, seqTenantB);
    }

    [Fact]
    public async Task SequenceManager_ConcurrentRequests_ShouldIncrementWithoutCollisions()
    {
        // Arrange
        var dbName = "Test_Concurrent_Db_" + Guid.NewGuid();
        var options = new DbContextOptionsBuilder<ElectronicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        int taskCount = 10;
        var results = new System.Collections.Concurrent.ConcurrentBag<int>();

        // Act - Simulate 10 concurrent requests to get next sequence for same tenant/estab/pto
        var tasks = Enumerable.Range(0, taskCount).Select(async _ =>
        {
            using var dbContext = new ElectronicBillingDbContext(options);
            var manager = new SequenceManager(dbContext);
            var seq = await manager.GetNextSequenceAsync("tenant_concurrent", "001", "001", DocumentType.Invoice);
            results.Add(seq);
        });

        await Task.WhenAll(tasks);

        // Assert - All 10 returned sequences must be unique values from 1 to 10
        Assert.Equal(taskCount, results.Count);
        Assert.Equal(taskCount, results.Distinct().Count());
        Assert.Contains(1, results);
        Assert.Contains(10, results);
    }

    [Fact]
    public async Task IdempotencyChecker_ShouldFindExistingDocumentByIdempotencyKey()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<ElectronicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: "Test_Idempotency_Db_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        using var dbContext = new ElectronicBillingDbContext(options);
        var tenantId = "tenant_idempotent";
        var key = "unique_idempotency_key_999";

        dbContext.ElectronicDocuments.Add(new ElectronicDocument
        {
            TenantId = tenantId,
            AccessKey = "2207202601092943351400120010020000000090000000913",
            Establishment = "001",
            EmissionPoint = "001",
            Sequential = "000000001",
            NoteNumber = "001-001-000000001",
            CustomerCedulaRuc = "0929433514",
            CustomerName = "Cliente",
            IdempotencyKey = key
        });
        await dbContext.SaveChangesAsync();

        var checker = new IdempotencyChecker(dbContext);

        // Act
        var request = new ElectronicInvoiceRequest
        {
            TenantId = tenantId,
            IdempotencyKey = key,
            Issuer = new IssuerData { Ruc = "0929433514001", SocialReason = "SR", MainAddress = "Addr" },
            Establishment = new EstablishmentData { Code = "001", EmissionPointCode = "001", Address = "Addr" },
            Customer = new CustomerData { IdentificationType = IdentificationType.Cedula, IdentificationNumber = "0929433514", SocialReason = "SR", Address = "Addr" },
            Lines = new List<InvoiceLine>(),
            Payments = new List<PaymentDetail>()
        };

        var foundDoc = await checker.FindExistingDocumentAsync(request);

        // Assert
        Assert.NotNull(foundDoc);
        Assert.Equal(key, foundDoc?.IdempotencyKey);
    }
}
