const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/turnos',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empleados (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      tarifa_hora DOUBLE PRECISION DEFAULT 4750,
      tarifa_hora_extra DOUBLE PRECISION DEFAULT 4750
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS turnos (
      id SERIAL PRIMARY KEY,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      hora_entrada TIMESTAMPTZ NOT NULL,
      hora_salida TIMESTAMPTZ,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
      nombre_evento TEXT,
      area TEXT,
      horas_trabajadas DOUBLE PRECISION,
      horas_extra DOUBLE PRECISION,
      valor_horas_extra DOUBLE PRECISION,
      valor_fijo DOUBLE PRECISION,
      sueldo_total DOUBLE PRECISION
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      usuario TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { pool, initDb };
