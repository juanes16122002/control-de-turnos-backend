const { pool } = require('../db');
const { TARIFA_HORA, TARIFA_HORA_EXTRA } = require('../config/tarifas');

exports.listar = async () => {
  const { rows } = await pool.query(
    'SELECT id, nombre, tarifa_hora, tarifa_hora_extra FROM empleados ORDER BY nombre'
  );
  return rows;
};

exports.obtener = async (id) => {
  const { rows } = await pool.query('SELECT * FROM empleados WHERE id = $1', [id]);
  return rows[0] || null;
};

exports.crear = async (nombre, tarifaHora, tarifaHoraExtra) => {
  const { rows } = await pool.query(
    'INSERT INTO empleados (nombre, tarifa_hora, tarifa_hora_extra) VALUES ($1, $2, $3) RETURNING *',
    [nombre, tarifaHora ?? TARIFA_HORA, tarifaHoraExtra ?? TARIFA_HORA_EXTRA]
  );
  return rows[0];
};

exports.actualizar = async (id, data) => {
  const fields = [];
  const params = [];
  let idx = 1;

  if (data.nombre !== undefined) {
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
    `UPDATE empleados SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0] || null;
};

exports.eliminar = async (id) => {
  const result = await pool.query('DELETE FROM empleados WHERE id = $1', [id]);
  return result.rowCount > 0;
};
