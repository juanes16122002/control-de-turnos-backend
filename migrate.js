require('dotenv').config();
const sqlite3 = require('sqlite3');
const { pool } = require('./db');

const sqlite = new sqlite3.Database('./horarios.db', sqlite3.OPEN_READONLY);

async function migrate() {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS empleados (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, tarifa_hora DOUBLE PRECISION DEFAULT 4750, tarifa_hora_extra DOUBLE PRECISION DEFAULT 4750)');
    await pool.query('CREATE TABLE IF NOT EXISTS empresas (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL)');
    await pool.query(`CREATE TABLE IF NOT EXISTS turnos (id SERIAL PRIMARY KEY, empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE, fecha DATE NOT NULL, hora_entrada TIMESTAMPTZ NOT NULL, hora_salida TIMESTAMPTZ, empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL, nombre_evento TEXT, area TEXT, horas_trabajadas DOUBLE PRECISION, horas_extra DOUBLE PRECISION, valor_horas_extra DOUBLE PRECISION, valor_fijo DOUBLE PRECISION, sueldo_total DOUBLE PRECISION)`);

    sqlite.serialize(() => {
      sqlite.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
        if (err) throw err;
        tables.forEach(t => {
          sqlite.all(`SELECT * FROM "${t.name}"`, async (err, rows) => {
            if (err) throw err;
            if (rows.length === 0) return;
            const tableName = t.name;
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(',');
            const colList = columns.join(',');

            for (const row of rows) {
              const values = columns.map(c => row[c]);
              await pool.query(`INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`, values);
            }
            console.log(`Migradas ${rows.length} filas a "${tableName}"`);
          });
        });
      });
    });

    sqlite.close();
    console.log('Migración completada.');
  } catch (err) {
    console.error('Error en migración:', err);
  } finally {
    await pool.end();
  }
}

migrate();
