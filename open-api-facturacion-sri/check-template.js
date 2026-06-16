const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
pool.query('SELECT html FROM "Template" LIMIT 1').then(r => {
  if (r.rows.length > 0) {
    console.log(r.rows[0].html.substring(0, 1500));
  } else {
    console.log("No templates found");
  }
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
