const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { createCipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();

dotenv.config({ path: '.env.development' });

const neonPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

const dotnetDbPath = 'C:\\Users\\Admin\\Desktop\\JAIRO\\PROYECTOS\\ERP-STORE-FAST-FAC_ELECTRONICA-API\\backend-api\\erp_store.db';

function queryDotnet() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dotnetDbPath, (err) => {
      if (err) return reject(err);
      db.get('SELECT "SriP12Certificate", "SriP12Password" FROM "CompanySettings" LIMIT 1', (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(row);
      });
    });
  });
}

async function encrypt(plainText) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const encryptionSalt = process.env.ENCRYPTION_SALT;
  const scryptAsync = promisify(scrypt);
  const key = await scryptAsync(encryptionKey, encryptionSalt, 32);
  
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function run() {
  try {
    console.log("Fetching from .NET DB...");
    const row = await queryDotnet();
    if (!row || !row.SriP12Certificate) {
      console.log('No cert found in .NET DB');
      process.exit(1);
    }
    const p12Buffer = row.SriP12Certificate;
    const p12Password = row.SriP12Password;
    console.log(`Found cert of size ${p12Buffer.length} bytes`);

    const certsDir = 'C:\\Users\\Admin\\Desktop\\JAIRO\\PROYECTOS\\certs';
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }
    const fileName = '0929433514001.p12';
    const filePath = path.join(certsDir, fileName);
    fs.writeFileSync(filePath, p12Buffer);
    console.log(`Saved cert to ${filePath}`);

    const encryptedPwd = await encrypt(p12Password);
    console.log(`Encrypted password to save`);

    await neonPool.query(
      `UPDATE emisores 
       SET certificado_nombre = $1, certificado_password_encrypted = $2 
       WHERE ruc = $3`,
      [fileName, encryptedPwd, '0929433514001']
    );
    console.log('Updated Neon DB successfully!');

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
