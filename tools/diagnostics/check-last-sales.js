const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgres://neondb_owner:YOUR_DB_PASSWORD@your-neon-host.neon.tech/neondb?sslmode=require"
  });

  try {
    await client.connect();
    console.log("Conectado a PostgreSQL...");

    const res = await client.query(`
      SELECT s."Id", s."TotalAmount", s."CreatedAt", s."SriStatus", s."SriAccessKey"
      FROM "Sales" s
      ORDER BY s."CreatedAt" DESC
      LIMIT 5;
    `);

    console.log("Últimas 5 ventas:");
    console.table(res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
