using ElectronicBilling.Core.Enums;
using System.Text;

namespace ElectronicBilling.Sri;

public static class AccessKeyGenerator
{
    public static string GenerateAccessKey(
        DateTime emissionDate,
        DocumentType documentType,
        string ruc,
        SriEnvironment environment,
        string establishment,
        string emissionPoint,
        string sequential,
        string? numericCode = null,
        string emissionType = "1")
    {
        var dateStr = emissionDate.ToString("ddMMyyyy");
        var docTypeCode = ((int)documentType).ToString("D2");
        var cleanRuc = (ruc ?? "").Trim().PadLeft(13, '0');
        var envCode = ((int)environment).ToString();
        var estabCode = (establishment ?? "001").PadLeft(3, '0');
        var ptoCode = (emissionPoint ?? "001").PadLeft(3, '0');
        var seqCode = (sequential ?? "1").PadLeft(9, '0');
        
        var numCode = string.IsNullOrEmpty(numericCode)
            ? seqCode.Substring(Math.Max(0, seqCode.Length - 8)).PadLeft(8, '0')
            : numericCode.PadLeft(8, '0');

        var key48 = $"{dateStr}{docTypeCode}{cleanRuc}{envCode}{estabCode}{ptoCode}{seqCode}{numCode}{emissionType}";
        
        if (key48.Length != 48)
        {
            throw new InvalidOperationException($"La clave sin verificador debe tener 48 dígitos (actual: {key48.Length})");
        }

        var verifierDigit = CalculateModulo11(key48);
        return $"{key48}{verifierDigit}";
    }

    public static int CalculateModulo11(string key48)
    {
        int sum = 0;
        int weight = 2;

        for (int i = key48.Length - 1; i >= 0; i--)
        {
            int digit = key48[i] - '0';
            sum += digit * weight;
            weight++;
            if (weight > 7) weight = 2;
        }

        int mod = 11 - (sum % 11);
        if (mod == 11) return 0;
        if (mod == 10) return 1;
        return mod;
    }
}
