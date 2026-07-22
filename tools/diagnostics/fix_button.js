const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgres://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
  });

  await client.connect();

  const res = await client.query(`
    UPDATE "Sales"
    SET "NoteNumber" = NULL, 
        "SriErrorMessage" = 'Reintento manual habilitado', 
        "ElectronicStatus" = 'ERROR', 
        "IsElectronic" = true, 
        "AccessKey" = NULL, 
        "AuthorizationNumber" = NULL
    WHERE "Id" = 61
  `);

  console.log(`Updated ${res.rowCount} rows.`);
  await client.end();
}

run().catch(console.error);
