using ElectronicBilling.Application.UseCases;
using ElectronicBilling.Core.Interfaces;
using ElectronicBilling.Infrastructure.Notifiers;
using ElectronicBilling.Infrastructure.Pdf;
using ElectronicBilling.Infrastructure.Persistence;
using ElectronicBilling.Infrastructure.Security;
using ElectronicBilling.Infrastructure.Services;
using ElectronicBilling.Sri;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ElectronicBilling.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddElectronicBillingModule(this IServiceCollection services, IConfiguration configuration, string connectionStringName = "DefaultConnection")
    {
        var connectionString = configuration.GetConnectionString(connectionStringName);

        services.AddDbContext<ElectronicBillingDbContext>(options =>
        {
            if (!string.IsNullOrEmpty(connectionString))
            {
                options.UseNpgsql(connectionString);
            }
            else
            {
                options.UseInMemoryDatabase("ElectronicBillingModuleDb");
            }
        });

        var secretKey = configuration["ElectronicBilling:SecretKey"] ?? "ElectronicBilling_DefaultMasterSecretKey_32Bytes!!";
        services.AddSingleton<ICertificateManager>(new CertificateManager(secretKey));

        services.AddScoped<ISequenceManager, SequenceManager>();
        services.AddScoped<ISriXmlSigner, SriXadesBesSigner>();
        services.AddScoped<ISriXmlSignatureValidator, SriXmlSignatureValidator>();
        services.AddHttpClient<ISriSoapClient, SriSoapClient>();
        services.AddScoped<IRideGenerator, RidePdfGenerator>();
        services.AddScoped<IEmailNotifier, EmailNotifier>();
        services.AddScoped<IElectronicBillingService, ElectronicBillingService>();

        return services;
    }
}
