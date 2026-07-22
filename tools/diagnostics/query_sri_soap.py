import urllib.request
import xml.etree.ElementTree as ET

def check_sri():
    url = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline"
    
    soap_body = """<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:autorizacionComprobante>
         <claveAcceso>1307202601092943351400120010020000000090000000913</claveAcceso>
      </ec:autorizacionComprobante>
   </soapenv:Body>
</soapenv:Envelope>"""

    headers = {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction": ""
    }
    
    req = urllib.request.Request(url, data=soap_body.encode('utf-8'), headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            print("SRI SOAP Response:\n")
            print(html)
    except Exception as e:
        print("Error connecting to SRI:", e)

if __name__ == "__main__":
    check_sri()
