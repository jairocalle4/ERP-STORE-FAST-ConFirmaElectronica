const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").then(r => {
  console.log(r.rows.map(row => row.table_name));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
