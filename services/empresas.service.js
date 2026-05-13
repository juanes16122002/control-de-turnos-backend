const { pool } = require('../db');

exports.listar = async () => {
  const { rows } = await pool.query('SELECT id, nombre FROM empresas ORDER BY nombre');
  return rows;
};

exports.crear = async (nombre) => {
  const { rows } = await pool.query(
    'INSERT INTO empresas (nombre) VALUES ($1) RETURNING id, nombre',
    [nombre]
  );
  return rows[0];
};

exports.actualizar = async (id, nombre) => {
  const { rows } = await pool.query(
    'UPDATE empresas SET nombre = $1 WHERE id = $2 RETURNING id, nombre',
    [nombre, id]
  );
  return rows[0] || null;
};

exports.eliminar = async (id) => {
  const result = await pool.query('DELETE FROM empresas WHERE id = $1', [id]);
  return result.rowCount > 0;
};
