using System.Xml.Linq;
using ElectronicBilling.Sri;
using Xunit;

namespace ElectronicBilling.Tests;

public class SriSoapClientTests
{
    [Fact]
    public void ParseSriReceptionResponse_ShouldExtractStatusAndMessages()
    {
        // Arrange - Sample SRI Reception SOAP Response XML
        var soapResponseXml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <ns2:validarComprobanteResponse xmlns:ns2=""http://ec.gob.sri.ws.recepcion"">
      <RespuestaRecepcionComprobante>
        <estado>RECIBIDA</estado>
        <comprobantes>
          <comprobante>
            <claveAcceso>2207202601092943351400120010020000000090000000913</claveAcceso>
            <mensajes/>
          </comprobante>
        </comprobantes>
      </RespuestaRecepcionComprobante>
    </ns2:validarComprobanteResponse>
  </soap:Body>
</soap:Envelope>";

        // Act
        var doc = XDocument.Parse(soapResponseXml);
        var estado = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "estado")?.Value;

        // Assert
        Assert.Equal("RECIBIDA", estado);
    }

    [Fact]
    public void ParseSriAuthorizationResponse_ShouldExtractAuthorizationStateAndDate()
    {
        // Arrange - Sample SRI Authorization SOAP Response XML
        var soapResponseXml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <ns2:autorizacionComprobanteResponse xmlns:ns2=""http://ec.gob.sri.ws.autorizacion"">
      <RespuestaAutorizacionComprobante>
        <claveAccesoConsultada>2207202601092943351400120010020000000090000000913</claveAccesoConsultada>
        <numeroComprobantes>1</numeroComprobantes>
        <autorizaciones>
          <autorizacion>
            <estado>AUTORIZADO</estado>
            <numeroAutorizacion>2207202601092943351400120010020000000090000000913</numeroAutorizacion>
            <fechaAutorizacion class=""dateTime"">2026-07-22T11:30:00-05:00</fechaAutorizacion>
            <ambiente>PRODUCCION</ambiente>
          </autorizacion>
        </autorizaciones>
      </RespuestaAutorizacionComprobante>
    </ns2:autorizacionComprobanteResponse>
  </soap:Body>
</soap:Envelope>";

        // Act
        var doc = XDocument.Parse(soapResponseXml);
        var estado = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "estado")?.Value;
        var numAuth = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "numeroAutorizacion")?.Value;

        // Assert
        Assert.Equal("AUTORIZADO", estado);
        Assert.Equal("2207202601092943351400120010020000000090000000913", numAuth);
    }
}
