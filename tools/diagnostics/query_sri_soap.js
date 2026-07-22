const https = require('https');

const soapBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:autorizacionComprobante>
         <claveAcceso>1307202601092943351400120010020000000090000000913</claveAcceso>
      </ec:autorizacionComprobante>
   </soapenv:Body>
</soapenv:Envelope>`;

const options = {
  hostname: 'cel.sri.gob.ec',
  port: 443,
  path: '/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml;charset=UTF-8',
    'Content-Length': Buffer.byteLength(soapBody)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('SRI SOAP Response:\n');
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`Error connecting to SRI: ${e.message}`);
});

req.write(soapBody);
req.end();
