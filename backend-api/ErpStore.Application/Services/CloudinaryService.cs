using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Configuration;

namespace ErpStore.Application.Services;

public interface ICloudinaryService
{
    Task<string?> UploadImageAsync(Stream fileStream, string fileName, string? cloudName = null, string? apiKey = null, string? apiSecret = null);
    Task<string?> UploadVideoAsync(Stream fileStream, string fileName, string? cloudName = null, string? apiKey = null, string? apiSecret = null);
    Task<bool> TestConnectionAsync(string? cloudName = null, string? apiKey = null, string? apiSecret = null);
}

public class CloudinaryService : ICloudinaryService
{
    private readonly IConfiguration _configuration;

    public CloudinaryService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private Cloudinary GetCloudinaryClient(string? customCloudName, string? customApiKey, string? customApiSecret)
    {
        string cloudName = !string.IsNullOrWhiteSpace(customCloudName) 
            ? customCloudName 
            : _configuration["CloudinarySettings:CloudName"] ?? "";
            
        string apiKey = !string.IsNullOrWhiteSpace(customApiKey) 
            ? customApiKey 
            : _configuration["CloudinarySettings:ApiKey"] ?? "";
            
        string apiSecret = !string.IsNullOrWhiteSpace(customApiSecret) 
            ? customApiSecret 
            : _configuration["CloudinarySettings:ApiSecret"] ?? "";

        var account = new Account(cloudName, apiKey, apiSecret);
        var cloudinary = new Cloudinary(account);
        cloudinary.Api.Secure = true;
        return cloudinary;
    }

    public async Task<string?> UploadImageAsync(Stream fileStream, string fileName, string? cloudName = null, string? apiKey = null, string? apiSecret = null)
    {
        var cloudinary = GetCloudinaryClient(cloudName, apiKey, apiSecret);
        var uploadParams = new ImageUploadParams()
        {
            File = new FileDescription(fileName, fileStream),
            Folder = "erp-store/products",
            UseFilename = true,
            UniqueFilename = true
        };

        var uploadResult = await cloudinary.UploadAsync(uploadParams);
        return uploadResult?.SecureUrl?.ToString();
    }

    public async Task<string?> UploadVideoAsync(Stream fileStream, string fileName, string? cloudName = null, string? apiKey = null, string? apiSecret = null)
    {
        var cloudinary = GetCloudinaryClient(cloudName, apiKey, apiSecret);
        var uploadParams = new VideoUploadParams()
        {
            File = new FileDescription(fileName, fileStream),
            Folder = "erp-store/videos"
        };

        var uploadResult = await cloudinary.UploadAsync(uploadParams);
        return uploadResult?.SecureUrl?.ToString();
    }

    public async Task<bool> TestConnectionAsync(string? cloudName = null, string? apiKey = null, string? apiSecret = null)
    {
        try
        {
            var cloudinary = GetCloudinaryClient(cloudName, apiKey, apiSecret);
            // Usamos PingAsync para validar las credenciales
            var result = await cloudinary.PingAsync();
            return result.StatusCode == System.Net.HttpStatusCode.OK;
        }
        catch
        {
            return false;
        }
    }
}
