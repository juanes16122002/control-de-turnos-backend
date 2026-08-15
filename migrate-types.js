// Migración de columnas de texto a tipos reales en PostgreSQL.
// Uso: node migrate-types.js
// Idempotente: solo altera columnas que aún sean TEXT.
require('dotenv').config();
const { pool } = require('./db');

async function getColumnType(table, column) {
  const { rows } = await pool.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows[0] ? rows[0].data_type : null;
}

async function main() {
  const changes = [];

  const tipoFecha = await getColumnType('turnos', 'fecha');
  if (tipoFecha === 'text') {
    await pool.query(`
      ALTER TABLE turnos
        ALTER COLUMN fecha TYPE DATE USING fecha::date
    `);
    changes.push('fecha: text -> date');
  }

  const tipoEntrada = await getColumnType('turnos', 'hora_entrada');
  if (tipoEntrada === 'text') {
    await pool.query(`
      ALTER TABLE turnos
        ALTER COLUMN hora_entrada TYPE TIMESTAMPTZ USING hora_entrada::timestamptz,
        ALTER COLUMN hora_salida TYPE TIMESTAMPTZ USING hora_salida::timestamptz
    `);
    changes.push('hora_entrada/hora_salida: text -> timestamptz');
  }

  if (changes.length === 0) {
    console.log('No se requirieron cambios: las columnas ya usan tipos correctos.');
  } else {
    for (const c of changes) console.log(`OK: ${c}`);
  }
}

main()
  .catch((err) => {
    console.error('Error en migración:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
