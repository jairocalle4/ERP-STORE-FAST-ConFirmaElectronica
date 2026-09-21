using ErpStore.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ErpStore.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/media")]
public class MediaController : ControllerBase
{
    private readonly ICloudinaryService _cloudinaryService;
    private readonly ErpStore.Infrastructure.Persistence.AppDbContext _context;

    public MediaController(ICloudinaryService cloudinaryService, ErpStore.Infrastructure.Persistence.AppDbContext context)
    {
        _cloudinaryService = cloudinaryService;
        _context = context;
    }

    [HttpPost("upload-image")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("No se proporcionó ningún archivo");

        var settings = await _context.CompanySettings.FirstOrDefaultAsync();

        using var stream = file.OpenReadStream();
        var url = await _cloudinaryService.UploadImageAsync(
            stream, 
            file.FileName, 
            settings?.CloudinaryCloudName, 
            settings?.CloudinaryApiKey, 
            settings?.CloudinaryApiSecret
        );

        if (string.IsNullOrEmpty(url)) return StatusCode(500, "Error al subir imagen a Cloudinary");

        return Ok(new { url });
    }

    [HttpPost("upload-video")]
    public async Task<IActionResult> UploadVideo(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("No se proporcionó ningún archivo");

        var settings = await _context.CompanySettings.FirstOrDefaultAsync();

        using var stream = file.OpenReadStream();
        var url = await _cloudinaryService.UploadVideoAsync(
            stream, 
            file.FileName,
            settings?.CloudinaryCloudName, 
            settings?.CloudinaryApiKey, 
            settings?.CloudinaryApiSecret
        );

        if (string.IsNullOrEmpty(url)) return StatusCode(500, "Error al subir video a Cloudinary");

        return Ok(new { url });
    }

    [HttpPost("test-cloudinary")]
    public async Task<IActionResult> TestCloudinary([FromBody] TestCloudinaryDto? dto)
    {
        string? cloudName = dto?.CloudName;
        string? apiKey = dto?.ApiKey;
        string? apiSecret = dto?.ApiSecret;

        // Si no se pasaron credenciales completas o son máscaras, usar las guardadas en la base de datos o en configuración
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("••") || string.IsNullOrWhiteSpace(apiSecret) || apiSecret.StartsWith("••"))
        {
            var company = await _context.CompanySettings.FirstOrDefaultAsync();
            cloudName = !string.IsNullOrWhiteSpace(cloudName) ? cloudName : company?.CloudinaryCloudName;
            apiKey = !string.IsNullOrWhiteSpace(company?.CloudinaryApiKey) ? company.CloudinaryApiKey : null;
            apiSecret = !string.IsNullOrWhiteSpace(company?.CloudinaryApiSecret) ? company.CloudinaryApiSecret : null;
        }

        var isSuccess = await _cloudinaryService.TestConnectionAsync(cloudName, apiKey, apiSecret);
        
        if (isSuccess)
        {
            return Ok(new { message = "Conexión a Cloudinary exitosa." });
        }
        else
        {
            return BadRequest(new { message = "Las credenciales de Cloudinary son inválidas o no se pudo establecer conexión." });
        }
    }
}

public class TestCloudinaryDto
{
    public string? CloudName { get; set; }
    public string? ApiKey { get; set; }
    public string? ApiSecret { get; set; }
}
