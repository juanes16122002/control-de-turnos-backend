const { pool } = require('../db');
const AppError = require('../utils/AppError');
const { TARIFA_HORA, TARIFA_HORA_EXTRA } = require('../config/tarifas');

// Columnas públicas: nunca exponer pin_hash ni datos de bloqueo
const COLUMNAS = `id, nombre, tarifa_hora, tarifa_hora_extra, (pin_hash IS NOT NULL) AS tiene_pin`;

// Incluye cuántos turnos, eventos y asistencias tiene cada técnico (al eliminarlo se borran turnos y asistencias)
exports.listar = async () => {
  const { rows } = await pool.query(`
    SELECT ${COLUMNAS},
      (SELECT COUNT(*)::int FROM turnos t WHERE t.empleado_id = empleados.id) AS total_turnos,
      (SELECT COUNT(*)::int FROM evento_empleados ee WHERE ee.empleado_id = empleados.id) AS total_eventos,
      (SELECT COUNT(*)::int FROM asistencias a WHERE a.empleado_id = empleados.id) AS total_asistencias
    FROM empleados ORDER BY nombre
  `);
  return rows;
};

// Evita dos técnicos con el mismo nombre (sin distinguir mayúsculas ni espacios extra):
// en el kiosco y en los listados serían indistinguibles
async function verificarNombreLibre(nombre, excluirId = null) {
  const { rows } = await pool.query(
    `SELECT nombre FROM empleados
     WHERE lower(btrim(nombre)) = lower(btrim($1)) AND ($2::int IS NULL OR id <> $2)
     LIMIT 1`,
    [nombre, excluirId]
  );
  if (rows[0]) {
    throw new AppError(409, `Ya existe un técnico llamado "${rows[0].nombre}". Agrega el apellido para distinguirlos.`);
  }
}

exports.obtener = async (id) => {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM empleados WHERE id = $1`, [id]);
  return rows[0] || null;
};

exports.crear = async (nombre, tarifaHora, tarifaHoraExtra) => {
  await verificarNombreLibre(nombre);
  const { rows } = await pool.query(
    'INSERT INTO empleados (nombre, tarifa_hora, tarifa_hora_extra) VALUES ($1, $2, $3) RETURNING ' + COLUMNAS,
    [nombre, tarifaHora ?? TARIFA_HORA, tarifaHoraExtra ?? TARIFA_HORA_EXTRA]
  );
  return rows[0];
};

exports.actualizar = async (id, data) => {
  const fields = [];
  const params = [];
  let idx = 1;

  if (data.nombre !== undefined) {
    await verificarNombreLibre(data.nombre, id);
    fields.push(`nombre = $${idx++}`);
    params.push(data.nombre);
  }
  if (data.tarifa_hora !== undefined) {
    fields.push(`tarifa_hora = $${idx++}`);
    params.push(data.tarifa_hora);
  }
  if (data.tarifa_hora_extra !== undefined) {
    fields.push(`tarifa_hora_extra = $${idx++}`);
    params.push(data.tarifa_hora_extra);
  }

  if (fields.length === 0) return null;

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE empleados SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${COLUMNAS}`,
    params
  );
  return rows[0] || null;
};

exports.eliminar = async (id) => {
  const result = await pool.query('DELETE FROM empleados WHERE id = $1', [id]);
  return result.rowCount > 0;
};
