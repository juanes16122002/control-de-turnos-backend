const { pool } = require('../db');
const AppError = require('../utils/AppError');

// Incluye cuántos eventos y turnos tiene cada empresa (para saber si se puede borrar)
exports.listar = async () => {
  const { rows } = await pool.query(`
    SELECT em.id, em.nombre,
      (SELECT COUNT(*)::int FROM eventos ev WHERE ev.empresa_id = em.id) AS total_eventos,
      (SELECT COUNT(*)::int FROM turnos t WHERE t.empresa_id = em.id) AS total_turnos
    FROM empresas em
    ORDER BY em.nombre
  `);
  return rows;
};

// Evita dos empresas con el mismo nombre (sin distinguir mayúsculas ni espacios extra)
async function verificarNombreLibre(nombre, excluirId = null) {
  const { rows } = await pool.query(
    `SELECT nombre FROM empresas
     WHERE lower(btrim(nombre)) = lower(btrim($1)) AND ($2::int IS NULL OR id <> $2)
     LIMIT 1`,
    [nombre, excluirId]
  );
  if (rows[0]) throw new AppError(409, `Ya existe una empresa llamada "${rows[0].nombre}"`);
}

exports.crear = async (nombre) => {
  await verificarNombreLibre(nombre);
  const { rows } = await pool.query(
    'INSERT INTO empresas (nombre) VALUES ($1) RETURNING id, nombre',
    [nombre]
  );
  return rows[0];
};

exports.actualizar = async (id, nombre) => {
  await verificarNombreLibre(nombre, id);
  const { rows } = await pool.query(
    'UPDATE empresas SET nombre = $1 WHERE id = $2 RETURNING id, nombre',
    [nombre, id]
  );
  return rows[0] || null;
};

exports.eliminar = async (id) => {
  try {
    const result = await pool.query('DELETE FROM empresas WHERE id = $1', [id]);
    return result.rowCount > 0;
  } catch (err) {
    // eventos.empresa_id es RESTRICT: un evento siempre debe tener su productora
    if (err.code === '23001' || err.code === '23503') {
      throw new AppError(409, 'No se puede eliminar: la empresa tiene eventos. Elimina o reasigna esos eventos primero.');
    }
    throw err;
  }
};
