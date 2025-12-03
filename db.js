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
      FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
    )
  `);
});

module.exports = db;
