using ElectronicBilling.Core.Enums;
using ElectronicBilling.Sri;
using Xunit;

namespace ElectronicBilling.Tests;

public class AccessKeyGeneratorTests
{
    [Fact]
    public void GenerateAccessKey_ShouldReturnValid49DigitKey()
    {
        // Arrange
        var date = new DateTime(2026, 7, 22);
        var docType = DocumentType.Invoice;
        var ruc = "0929433514001";
        var env = SriEnvironment.Production;
        var estab = "001";
        var pto = "002";
        var seq = "000000009";

        // Act
        var accessKey = AccessKeyGenerator.GenerateAccessKey(date, docType, ruc, env, estab, pto, seq);

        // Assert
        Assert.NotNull(accessKey);
        Assert.Equal(49, accessKey.Length);
        Assert.StartsWith("220720260109294335140012001002000000009", accessKey);
        
        // Verifier digit check
        var key48 = accessKey.Substring(0, 48);
        var expectedVerifier = int.Parse(accessKey.Substring(48, 1));
        var actualVerifier = AccessKeyGenerator.CalculateModulo11(key48);
        Assert.Equal(expectedVerifier, actualVerifier);
    }

    [Theory]
    [InlineData("220720260109294335140012001002000000009000000091", 2)]
    public void CalculateModulo11_ShouldComputeCorrectCheckDigit(string key48, int expectedVerifier)
    {
        // Act
        var verifier = AccessKeyGenerator.CalculateModulo11(key48);

        // Assert
        Assert.Equal(expectedVerifier, verifier);
    }
}
