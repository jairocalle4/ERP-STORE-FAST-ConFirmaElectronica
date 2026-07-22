using System.Text;
using System.Xml.Linq;
using ElectronicBilling.Core.Enums;
using ElectronicBilling.Core.Interfaces;
using ElectronicBilling.Core.Models;

namespace ElectronicBilling.Sri;

public class SriSoapClient : ISriSoapClient
{
    private readonly HttpClient _httpClient;

    public SriSoapClient(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    }

    public async Task<SriSoapReceptionResult> SendForReceptionAsync(string signedXmlContent, SriEnvironment environment)
    {
        var result = new SriSoapReceptionResult();
        var endpoint = environment == SriEnvironment.Production
            ? "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline"
            : "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline";

        var bytesBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(signedXmlContent));

        var soapEnvelope = $@"<soapenv:Envelope xmlns:soapenv=""http://schemas.xmlsoap.org/soap/envelope/"" xmlns:ec=""http://ec.gob.sri.ws.recepcion"">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:validarComprobante>
         <xml>{bytesBase64}</xml>
      </ec:validarComprobante>
   </soapenv:Body>
</soapenv:Envelope>";

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");

            using var response = await _httpClient.SendAsync(request);
            var xmlResponse = await response.Content.ReadAsStringAsync();

            var xDoc = XDocument.Parse(xmlResponse);
            XNamespace ns = "http://ec.gob.sri.ws.recepcion";

            var estadoNode = xDoc.Descendants("estado").FirstOrDefault();
            var estado = estadoNode?.Value ?? "RECIBIDA";

            result.Status = estado;
            result.Received = estado.Equals("RECIBIDA", StringComparison.OrdinalIgnoreCase);

            var comprobantes = xDoc.Descendants("comprobante");
            foreach (var comp in comprobantes)
            {
                var mensajes = comp.Descendants("mensaje");
                foreach (var m in mensajes)
                {
                    result.Messages.Add(new SriMessageInfo
                    {
                        Identifier = m.Element("identificador")?.Value,
                        Message = m.Element("mensaje")?.Value,
                        AdditionalInfo = m.Element("informacionAdicional")?.Value,
                        Type = m.Element("tipo")?.Value
                    });
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Received = false;
            result.Status = "ERROR";
            result.Messages.Add(new SriMessageInfo
            {
                Identifier = "SOAP_ERROR",
                Message = ex.Message,
                Type = "ERROR"
            });
            return result;
        }
    }

    public async Task<SriSoapAuthorizationResult> QueryAuthorizationAsync(string accessKey, SriEnvironment environment)
    {
        var result = new SriSoapAuthorizationResult();
        var endpoint = environment == SriEnvironment.Production
            ? "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
            : "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";

        var soapEnvelope = $@"<soapenv:Envelope xmlns:soapenv=""http://schemas.xmlsoap.org/soap/envelope/"" xmlns:ec=""http://ec.gob.sri.ws.autorizacion"">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:autorizacionComprobante>
         <claveAcceso>{accessKey}</claveAcceso>
      </ec:autorizacionComprobante>
   </soapenv:Body>
</soapenv:Envelope>";

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");

            using var response = await _httpClient.SendAsync(request);
            var xmlResponse = await response.Content.ReadAsStringAsync();

            var xDoc = XDocument.Parse(xmlResponse);

            var autorizacion = xDoc.Descendants("autorizacion").FirstOrDefault();
            if (autorizacion != null)
            {
                var estado = autorizacion.Element("estado")?.Value;
                var numeroAuth = autorizacion.Element("numeroAutorizacion")?.Value;
                var fechaAuthStr = autorizacion.Element("fechaAutorizacion")?.Value;
                var xmlAuth = autorizacion.Element("comprobante")?.Value;

                result.Status = estado ?? "NO AUTORIZADO";
                result.Authorized = string.Equals(estado, "AUTORIZADO", StringComparison.OrdinalIgnoreCase);
                result.AuthorizationNumber = numeroAuth;
                result.AuthorizedXml = xmlAuth;

                if (DateTime.TryParse(fechaAuthStr, out var parsedDate))
                {
                    result.AuthorizationDate = parsedDate;
                }
                else
                {
                    result.AuthorizationDate = DateTime.UtcNow;
                }

                var mensajes = autorizacion.Descendants("mensaje");
                foreach (var m in mensajes)
                {
                    result.Messages.Add(new SriMessageInfo
                    {
                        Identifier = m.Element("identificador")?.Value,
                        Message = m.Element("mensaje")?.Value,
                        AdditionalInfo = m.Element("informacionAdicional")?.Value,
                        Type = m.Element("tipo")?.Value
                    });
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Authorized = false;
            result.Status = "ERROR";
            result.Messages.Add(new SriMessageInfo
            {
                Identifier = "SOAP_ERROR",
                Message = ex.Message,
                Type = "ERROR"
            });
            return result;
        }
    }
}
