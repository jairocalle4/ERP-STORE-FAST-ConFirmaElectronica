using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using ElectronicBilling.Core.Interfaces;

namespace ElectronicBilling.Infrastructure.Security;

public class CertificateManager : ICertificateManager
{
    private readonly byte[] _masterKey;

    public CertificateManager(string? secretKey = null)
    {
        var rawKeyStr = secretKey ?? "ElectronicBilling_DefaultMasterSecret_Key_32Bytes!!";
        _masterKey = SHA256.HashData(Encoding.UTF8.GetBytes(rawKeyStr));
    }

    public (byte[] EncryptedBytes, string EncryptedPassword) ProtectCertificate(byte[] rawP12, string rawPassword)
    {
        var encryptedP12 = AesEncrypt(rawP12, _masterKey);
        var encryptedPasswordBytes = AesEncrypt(Encoding.UTF8.GetBytes(rawPassword ?? string.Empty), _masterKey);
        var encryptedPasswordBase64 = Convert.ToBase64String(encryptedPasswordBytes);

        return (encryptedP12, encryptedPasswordBase64);
    }

    public (byte[] RawP12, string RawPassword) UnprotectCertificate(byte[] encryptedBytes, string encryptedPassword)
    {
        var rawP12 = AesDecrypt(encryptedBytes, _masterKey);
        var encryptedPasswordBytes = Convert.FromBase64String(encryptedPassword ?? string.Empty);
        var rawPasswordBytes = AesDecrypt(encryptedPasswordBytes, _masterKey);
        var rawPassword = Encoding.UTF8.GetString(rawPasswordBytes);

        return (rawP12, rawPassword);
    }

    public (bool IsValid, DateTime ExpiryDate, string Subject, string? Error) ValidateP12(byte[] p12Bytes, string password)
    {
        try
        {
            using var cert = X509CertificateLoader.LoadPkcs12(p12Bytes, password, X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);
            var now = DateTime.Now;

            if (now < cert.NotBefore || now > cert.NotAfter)
            {
                return (false, cert.NotAfter, cert.Subject, $"El certificado está fuera de su período de validez. Válido desde {cert.NotBefore} hasta {cert.NotAfter}.");
            }

            using var rsa = cert.GetRSAPrivateKey();
            if (rsa == null)
            {
                return (false, cert.NotAfter, cert.Subject, "El certificado P12 no contiene una clave privada RSA válida.");
            }

            return (true, cert.NotAfter, cert.Subject, null);
        }
        catch (Exception ex)
        {
            return (false, DateTime.MinValue, string.Empty, $"Contraseña incorrecta o archivo P12 dañado: {ex.Message}");
        }
    }

    private static byte[] AesEncrypt(byte[] plainBytes, byte[] key)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.GenerateIV();

        using var ms = new MemoryStream();
        ms.Write(aes.IV, 0, aes.IV.Length);

        using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
        {
            cs.Write(plainBytes, 0, plainBytes.Length);
            cs.FlushFinalBlock();
        }

        return ms.ToArray();
    }

    private static byte[] AesDecrypt(byte[] cipherBytes, byte[] key)
    {
        using var ms = new MemoryStream(cipherBytes);
        var iv = new byte[16];
        ms.Read(iv, 0, iv.Length);

        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        using var msDecrypt = new MemoryStream();
        using (var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read))
        {
            cs.CopyTo(msDecrypt);
        }

        return msDecrypt.ToArray();
    }
}
