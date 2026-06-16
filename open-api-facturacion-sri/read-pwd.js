const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
pool.query('SELECT "ElectronicSignatureFile", "ElectronicSignaturePassword" FROM "CompanySettings" LIMIT 1').then(r => {
  const row = r.rows[0];
  console.log("Password:", row.ElectronicSignaturePassword);
  console.log("File len:", row.ElectronicSignatureFile ? row.ElectronicSignatureFile.length : 'NULL');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
