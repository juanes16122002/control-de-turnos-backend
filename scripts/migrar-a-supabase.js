// Copia los datos de una base PostgreSQL (origen) a otra (destino, p. ej. Supabase).
//
// Uso:
//   ORIGEN_DATABASE_URL=postgresql://...local... DATABASE_URL=postgresql://...supabase... \
//     node scripts/migrar-a-supabase.js [--dry-run]
//
// - Crea el esquema en el destino con initDb() (tablas, índices y RLS).
// - Copia empresas, empleados, turnos y asistencias conservando los IDs.
// - Ajusta las secuencias para que los próximos IDs no choquen.
// - Todo en una transacción: si algo falla, el destino queda sin cambios.
// - Se niega a correr si el destino ya tiene datos (evita duplicar o pisar).
// - refresh_tokens no se copia: los usuarios solo tendrán que volver a iniciar sesión.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { construirConfigPool } = require('../config/database');

const TABLAS_A_COPIAR = ['empresas', 'empleados', 'turnos', 'asistencias']; // orden por claves foráneas
const LOTE = 500;
const dryRun = process.argv.includes('--dry-run');

function clienteDesde(url, env) {
  const { _info, ...config } = construirConfigPool({ ...env, DATABASE_URL: url });
  return { cliente: new Client(config), info: _info };
}

async function columnas(cliente, tabla) {
  const { rows } = await cliente.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tabla]
  );
  return rows.map((r) => r.column_name);
}

async function main() {
  const urlOrigen = process.env.ORIGEN_DATABASE_URL;
  const urlDestino = process.env.DATABASE_URL;
  if (!urlOrigen || !urlDestino) {
    throw new Error('Define ORIGEN_DATABASE_URL (base actual) y DATABASE_URL (Supabase)');
  }
  if (urlOrigen === urlDestino) throw new Error('El origen y el destino son la misma base');

  // El SSL del origen se decide solo por su host (no hereda DB_SSL del destino)
  const envOrigen = { DB_SSL: process.env.ORIGEN_DB_SSL };
  const { cliente: origen, info: infoOrigen } = clienteDesde(urlOrigen, envOrigen);
  console.log(`Origen : ${infoOrigen.host}:${infoOrigen.puerto} (SSL ${infoOrigen.sslModo})`);

  // initDb usa el pool de db.js, que lee DATABASE_URL = destino
  const { pool: destino, initDb, infoConexion } = require('../db');
  console.log(`Destino: ${infoConexion.host}:${infoConexion.puerto} (SSL ${infoConexion.sslModo})${dryRun ? '  [DRY RUN]' : ''}`);

  await origen.connect();
  const clienteDestino = await destino.connect();
  try {
    if (!dryRun) {
      console.log('\nCreando esquema en el destino…');
      await initDb();
    }

    // Verificar que el destino esté vacío
    for (const tabla of TABLAS_A_COPIAR) {
      const existe = (await columnas(clienteDestino, tabla)).length > 0;
      if (!existe) continue;
      const { rows: [r] } = await clienteDestino.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`);
      if (r.n > 0) {
        throw new Error(`La tabla "${tabla}" del destino ya tiene ${r.n} filas. Abortado para no duplicar datos.`);
      }
    }

    await clienteDestino.query('BEGIN');
    const resumen = [];

    for (const tabla of TABLAS_A_COPIAR) {
      const colsOrigen = await columnas(origen, tabla);
      if (colsOrigen.length === 0) {
        resumen.push({ tabla, filas: 0, nota: 'no existe en el origen' });
        continue;
      }
      const colsDestino = dryRun ? colsOrigen : await columnas(clienteDestino, tabla);
      // Solo columnas presentes en ambos lados (el origen puede ser una versión anterior del esquema)
      const cols = colsOrigen.filter((c) => colsDestino.includes(c));
      const omitidas = colsOrigen.filter((c) => !colsDestino.includes(c));
      const lista = cols.map((c) => `"${c}"`).join(', ');

      const { rows } = await origen.query(`SELECT ${lista} FROM ${tabla} ORDER BY id`);

      if (!dryRun) {
        for (let i = 0; i < rows.length; i += LOTE) {
          const lote = rows.slice(i, i + LOTE);
          const valores = [];
          const tuplas = lote.map((fila, f) => {
            cols.forEach((c) => valores.push(fila[c]));
            return `(${cols.map((_, j) => `$${f * cols.length + j + 1}`).join(', ')})`;
          });
          await clienteDestino.query(`INSERT INTO ${tabla} (${lista}) VALUES ${tuplas.join(', ')}`, valores);
        }
        // Que el próximo SERIAL continúe después del mayor id copiado
        await clienteDestino.query(`
          SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL)
          FROM ${tabla}
        `);
      }
      resumen.push({ tabla, filas: rows.length, nota: omitidas.length ? `columnas omitidas: ${omitidas.join(', ')}` : '' });
    }

    if (dryRun) {
      await clienteDestino.query('ROLLBACK');
    } else {
      // Verificación: mismos conteos en el destino antes de confirmar
      for (const r of resumen) {
        if (!r.filas) continue;
        const { rows: [c] } = await clienteDestino.query(`SELECT COUNT(*)::int AS n FROM ${r.tabla}`);
        if (c.n !== r.filas) throw new Error(`Conteo distinto en ${r.tabla}: origen ${r.filas}, destino ${c.n}`);
      }
      await clienteDestino.query('COMMIT');
    }

    console.log('');
    console.table(resumen);
    console.log(dryRun ? 'Dry run: no se escribió nada.' : 'Migración completada y verificada.');
  } catch (err) {
    await clienteDestino.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    clienteDestino.release();
    await origen.end();
    await destino.end();
  }
}

main().catch((err) => {
  console.error('\nError en la migración:', err.message);
  process.exit(1);
});
