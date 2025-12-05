// db.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./horarios.db');

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  // Tabla de empleados
  db.run(`
    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL
    )
  `);

  // Tabla de empresas
  db.run(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL
    )
  `);

  // Tabla de turnos
  db.run(`
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      hora_entrada TEXT NOT NULL,
      hora_salida TEXT,
      empresa_id INTEGER,
      nombre_evento TEXT,
      area TEXT,
      horas_trabajadas REAL,
      horas_extra REAL,
      valor_horas_extra REAL,
      valor_fijo REAL,
      sueldo_total REAL,
      FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
    )
  `);

  // Si YA tenías la tabla creada sin estas columnas y NO quieres borrar horarios.db,
  // puedes ejecutar estos ALTER UNA sola vez (luego coméntalos o quítalos
  // porque si no fallan por "duplicate column name").
  /*
  db.run('ALTER TABLE turnos ADD COLUMN valor_horas_extra REAL', (err) => {
    if (err) console.log('ALTER valor_horas_extra (posible ya creada):', err.message);
  });
  db.run('ALTER TABLE turnos ADD COLUMN valor_fijo REAL', (err) => {
    if (err) console.log('ALTER valor_fijo (posible ya creada):', err.message);
  });
  db.run('ALTER TABLE turnos ADD COLUMN sueldo_total REAL', (err) => {
    if (err) console.log('ALTER sueldo_total (posible ya creada):', err.message);
  });
  */
});

module.exports = db;
