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
    
    // Force it to public for the DB AND Role
    await client.query(`ALTER DATABASE ${process.env.DB_NAME} SET search_path TO public;`);
    await client.query(`ALTER ROLE ${process.env.DB_USER} SET search_path TO public;`);
    console.log("Altered database and role search path to public.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
