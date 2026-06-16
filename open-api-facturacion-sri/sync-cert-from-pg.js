const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { createCipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.development' });

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

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
    const r = await pool.query('SELECT "ElectronicSignatureFile", "ElectronicSignaturePassword" FROM "CompanySettings" LIMIT 1');
    const row = r.rows[0];
    
    if (!row || !row.ElectronicSignatureFile) {
        console.log('No cert found'); process.exit(1);
    }
    const p12Buffer = row.ElectronicSignatureFile;
    const p12Password = row.ElectronicSignaturePassword;

    const certsDir = 'C:\\Users\\Admin\\Desktop\\JAIRO\\PROYECTOS\\certs';
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }
    const fileName = '0929433514001.p12';
    const filePath = path.join(certsDir, fileName);
    fs.writeFileSync(filePath, p12Buffer);
    console.log(`Saved cert to ${filePath}`);

    const encryptedPwd = await encrypt(p12Password);

    await pool.query(
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
