const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:YOUR_DB_PASSWORD@your-neon-host.neon.tech/neondb?sslmode=require'
});
client.connect().then(async () => {
  console.log("Read pwd ok.");
  await client.end();
}).catch(console.error);
