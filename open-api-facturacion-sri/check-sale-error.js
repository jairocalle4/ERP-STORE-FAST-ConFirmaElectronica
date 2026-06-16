const { Client } = require('pg');
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
    
    const res = await client.query('SELECT "Id", "ElectronicStatus", "SriErrorMessage" FROM "Sales" ORDER BY "Id" DESC LIMIT 1;');
    console.log("Last Sale:", res.rows[0]);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
