const fs = require('fs');
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
    console.log("Connected to DB");
    
    const sql = fs.readFileSync('database/init.sql', 'utf8');
    await client.query(sql);
    console.log("Successfully ran init.sql");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
