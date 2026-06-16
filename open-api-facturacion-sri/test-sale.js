const { Client } = require('pg');
const http = require('http');
require('dotenv').config({ path: '.env.development' });

async function run() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query("SET search_path TO public;");
    
    // Login to .NET
    const loginPayload = JSON.stringify({
      username: "jairo.ceo",
      password: "admin123"
    });
    
    const loginReq = http.request({
      hostname: 'localhost',
      port: 5140,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginPayload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        if (res.statusCode !== 200) {
           console.error("Login failed!", res.statusCode, data);
           client.end();
           return;
        }
        
        const token = JSON.parse(data).token;
        console.log("Logged in! Token obtained.");
        
        // Fetch data for Sale
        const clientDb = await client.query('SELECT "Id" FROM "Clients" LIMIT 1;');
        const employeeDb = await client.query('SELECT "Id" FROM "Employees" LIMIT 1;');
        const productDb = await client.query('SELECT "Id", "Price", "Cost" FROM "Productos" LIMIT 1;');
        
        const payload = JSON.stringify({
          clientId: clientDb.rows.length > 0 ? clientDb.rows[0].Id : null,
          employeeId: employeeDb.rows.length > 0 ? employeeDb.rows[0].Id : 1,
          cashRegisterSessionId: null,
          paymentMethod: "CASH",
          isElectronic: true,
          amountPaid: productDb.rows[0].Price,
          Details: [
            {
              ProductId: 3,
              Quantity: 1,
              UnitPrice: parseFloat(productDb.rows[0].Price),
              Subtotal: parseFloat(productDb.rows[0].Price)
            }
          ]
        });

        const saleReq = http.request({
          hostname: 'localhost',
          port: 5140,
          path: '/api/v1/sales',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': 'Bearer ' + token
          }
        }, res2 => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            console.log(`Sale Status: ${res2.statusCode}`);
            const saleResult = JSON.parse(data2);
            console.log(`Sale Created: ID ${saleResult.id}`);
            
            // Emit Electronic Bill
            const emitReq = http.request({
              hostname: 'localhost',
              port: 5140,
              path: `/api/v1/electronic-billing/emit/${saleResult.id}`,
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Length': 0
              }
            }, res3 => {
              let data3 = '';
              res3.on('data', chunk => data3 += chunk);
              res3.on('end', () => {
                console.log(`Emit Status: ${res3.statusCode}`);
                console.log(`Emit Body: ${data3}`);
                client.end();
              });
            });
            emitReq.on('error', e => console.error(`Emit Error: ${e.message}`));
            emitReq.end();
          });
        });

        saleReq.on('error', e => console.error(`Error: ${e.message}`));
        saleReq.write(payload);
        saleReq.end();
      });
    });

    loginReq.on('error', e => console.error(`Error: ${e.message}`));
    loginReq.write(loginPayload);
    loginReq.end();
    
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
