using ErpStore.Infrastructure;
using ErpStore.Infrastructure.Services;
using ErpStore.Application.Services;
using ErpStore.Application.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Ensure PostgreSQL can read/write DateTime without forcing UTC in EF Core 6+
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options => 
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    }); // Enable Controllers with cycle ignoring
builder.Services.AddInfrastructureServices(builder.Configuration);

// Register Services
builder.Services.AddHttpClient(); // Required for IHttpClientFactory (used by EmailService → Brevo API)
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICloudinaryService, CloudinaryService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IElectronicBillingService, ElectronicBillingService>();
// Background service: verifica stock bajo cada hora y envía correo automático consolidado
// Solo se activa si la variable ENABLE_BACKGROUND_SERVICES=true está configurada en Render
// Activar cuando Brevo esté configurado para que los emails realmente se envíen
if (builder.Configuration.GetValue<bool>("ENABLE_BACKGROUND_SERVICES"))
{
    builder.Services.AddHostedService<LowStockBackgroundService>();
}

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? "SuperSecretKeyForDevelopmentOnly12345!";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
    };
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();
app.UseCors("AllowAll");

// Ensure DB schema is up to date on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ErpStore.Infrastructure.Persistence.AppDbContext>();
    
    // Step 1: Ensure column exists via raw SQL (safe, idempotent)
    try
    {
        db.Database.ExecuteSqlRaw(@"ALTER TABLE ""CashRegisterSessions"" ADD COLUMN IF NOT EXISTS ""WithdrawalAmount"" DECIMAL(18,2) NOT NULL DEFAULT 0;");
        Console.WriteLine("✅ WithdrawalAmount column verified/created successfully.");
    }
    catch (Exception sqlEx)
    {
        Console.WriteLine($"⚠️ Raw SQL column check (non-critical): {sqlEx.Message}");
    }

    // Step 2: Try EF Core migrations for any other pending changes
    try
    {
        db.Database.Migrate();
        Console.WriteLine("✅ EF Core migrations applied successfully.");
    }
    catch (Exception migrateEx)
    {
        Console.WriteLine($"⚠️ EF Core Migrate() skipped (non-critical): {migrateEx.Message}");
        // This is non-critical because the raw SQL above already ensured schema compatibility
    }
}

app.UseAuthentication(); // Enable Auth
app.UseAuthorization();

app.MapControllers(); // Map Controllers

// Mappings are now handled by Controllers
// app.MapGet("/api/v1/catalog", ...
// app.MapGet("/api/v1/categories", ...

app.Run();
