const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgres://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
  });

  try {
    await client.connect();
    await client.query("SET search_path TO public;");
    
    console.log("Querying last 10 sales...");
    const res = await client.query('SELECT "Id", "NoteNumber", "Date", "Total", "IsElectronic", "ElectronicStatus", "AccessKey", "SriErrorMessage" FROM "Sales" ORDER BY "Id" DESC LIMIT 10;');
    console.table(res.rows);

    console.log("\nQuerying company settings sequence...");
    const resCompany = await client.query('SELECT "Id", "CurrentSequence", "SriEstablishment", "SriPointOfIssue" FROM "CompanySettings" LIMIT 1;');
    console.table(resCompany.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
