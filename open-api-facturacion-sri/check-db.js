const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
pool.query('SELECT "TributaryRegime" FROM "CompanySettings"').then(r => {
  console.log(r.rows);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
