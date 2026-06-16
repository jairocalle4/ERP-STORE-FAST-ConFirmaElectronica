const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  try {
    const res = await pool.query("SELECT id FROM emisores WHERE ruc = '0929433514001'");
    if (res.rows.length === 0) {
      console.log('No emisor found');
      process.exit(1);
    }
    const emisorId = res.rows[0].id;
    console.log('Emisor ID:', emisorId);

    // Insert establecimiento
    const estRes = await pool.query(
      "INSERT INTO establecimientos (emisor_id, codigo, direccion, estado) VALUES ($1, '001', 'Direccion matriz', 'ACTIVO') ON CONFLICT (emisor_id, codigo) DO UPDATE SET direccion = 'Direccion matriz' RETURNING id",
      [emisorId]
    );
    const estId = estRes.rows[0].id;
    console.log('Establecimiento ID:', estId);

    // Insert punto_emisiones
    await pool.query(
      "INSERT INTO puntos_emision (establecimiento_id, codigo, descripcion, estado) VALUES ($1, '001', 'Caja 1', 'ACTIVO') ON CONFLICT (establecimiento_id, codigo) DO NOTHING",
      [estId]
    );
    console.log('Punto emision 001 created');
    
    // Check if secuencial exists, if not create one
    const peRes = await pool.query("SELECT id FROM puntos_emision WHERE establecimiento_id = $1 AND codigo = '001'", [estId]);
    if (peRes.rows.length > 0) {
        const peId = peRes.rows[0].id;
        // 01 is Factura
        await pool.query(
            "INSERT INTO secuenciales (punto_emision_id, tipo_comprobante, ultimo_secuencial) VALUES ($1, '01', 0) ON CONFLICT (punto_emision_id, tipo_comprobante) DO NOTHING",
            [peId]
        );
        console.log('Secuencial para factura creado');
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
