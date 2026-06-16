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
    const res = await client.query('SELECT * FROM "Users" WHERE "Username" = \'jairo.ceo\'');
    console.log("Users found:", res.rows.length);
    if(res.rows.length === 0) {
      console.log("Creating default user jairo.ceo...");
      // We need to create it! But we don't know the hashed password. 
      // I'll just tell the user the DB was empty and ask if they ran a seeder.
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
