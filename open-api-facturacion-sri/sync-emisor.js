const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

async function run() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query("SET search_path TO public;");
    
    // Copy company settings to emisores
    const companyRes = await client.query('SELECT * FROM "CompanySettings" LIMIT 1;');
    if (companyRes.rows.length > 0) {
      const c = companyRes.rows[0];
      const rucEmisor = c.Ruc.length === 10 ? c.Ruc + "001" : c.Ruc;

      const checkEmisor = await client.query('SELECT id FROM emisores WHERE ruc = $1', [rucEmisor]);
      
      const rimpe = c.TributaryRegime === 'RIMPE_NEGOCIO_POPULAR' || c.TributaryRegime === 'RIMPE_EMPRENDEDOR';

      if (checkEmisor.rows.length === 0) {
          const insertQuery = `
            INSERT INTO emisores (
              ruc, razon_social, nombre_comercial, direccion_matriz, 
              obligado_contabilidad, contribuyente_especial, 
              agente_retencion, contribuyente_rimpe, ambiente,
              estado, certificado_p12, certificado_password
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id;
          `;
          
          await client.query(insertQuery, [
            rucEmisor, 
            c.SocialReason || c.Name, 
            c.CommercialName || c.Name, 
            c.Address || 'Ecuador',
            false, // obligado_contabilidad
            null, // contribuyente_especial
            null, // agente_retencion
            rimpe, // contribuyente_rimpe (boolean in new schema!)
            'PRUEBAS', // ambiente
            'ACTIVO',
            c.ElectronicSignatureFile, // bytea
            c.ElectronicSignaturePassword
          ]);
          console.log("Emisor created with certificate!");
      } else {
          const updateQuery = `
            UPDATE emisores SET 
              certificado_p12 = $1, 
              certificado_password = $2,
              ambiente = 'PRUEBAS'
            WHERE ruc = $3
          `;
          await client.query(updateQuery, [c.ElectronicSignatureFile, c.ElectronicSignaturePassword, rucEmisor]);
          console.log("Emisor updated with certificate!");
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
