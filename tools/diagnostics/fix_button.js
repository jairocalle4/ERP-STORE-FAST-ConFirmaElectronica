const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgres://neondb_owner:YOUR_DB_PASSWORD@your-neon-host.neon.tech/neondb?sslmode=require"
  });

  try {
    await client.connect();
    await client.query('UPDATE "TenantSettings" SET "CurrentSequence" = "CurrentSequence" + 1;');
    console.log("Secuencia incrementada exitosamente.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
