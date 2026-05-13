const { pool } = require('../db');
const { calcularHorasBaseYExtra } = require('../helpers/tiempo');
const { TARIFA_HORA, TARIFA_HORA_EXTRA } = require('../config/tarifas');

exports.calcularValores = async (horaEntrada, horaSalida, empleadoId) => {
  const { base, extra } = calcularHorasBaseYExtra(horaEntrada, horaSalida);
  const horasTrab = base || 0;
  const horasExtra = extra || 0;

  let tarifaHora = TARIFA_HORA;
  let tarifaHoraExtra = TARIFA_HORA_EXTRA;

  if (empleadoId) {
    const { rows } = await pool.query('SELECT tarifa_hora, tarifa_hora_extra FROM empleados WHERE id = $1', [empleadoId]);
    const emp = rows[0];
    if (emp) {
      if (emp.tarifa_hora != null) tarifaHora = emp.tarifa_hora;
      if (emp.tarifa_hora_extra != null) tarifaHoraExtra = emp.tarifa_hora_extra;
    }
  }

  const valor_fijo = horasTrab * tarifaHora;
  const valor_horas_extra = horasExtra * tarifaHoraExtra;
  return { horasTrab, horasExtra, valor_fijo, valor_horas_extra, sueldo_total: valor_fijo + valor_horas_extra };
};

exports.crear = async (data) => {
  const v = await exports.calcularValores(data.hora_entrada, data.hora_salida, data.empleado_id);
  const { rows } = await pool.query(`
    INSERT INTO turnos
      (empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area,
       horas_trabajadas, horas_extra, valor_horas_extra, valor_fijo, sueldo_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
  `, [data.empleado_id, data.fecha, data.hora_entrada, data.hora_salida || null,
       data.empresa_id || null, data.nombre_evento, data.area,
       v.horasTrab, v.horasExtra, v.valor_horas_extra, v.valor_fijo, v.sueldo_total]);

  return { id: rows[0].id, ...data, ...v };
};

exports.actualizar = async (id, data) => {
  const v = await exports.calcularValores(data.hora_entrada, data.hora_salida, data.empleado_id);
  const result = await pool.query(`
    UPDATE turnos
    SET empleado_id = $1, fecha = $2, hora_entrada = $3, hora_salida = $4,
        empresa_id = $5, nombre_evento = $6, area = $7,
        horas_trabajadas = $8, horas_extra = $9, valor_horas_extra = $10,
        valor_fijo = $11, sueldo_total = $12
    WHERE id = $13
  `, [data.empleado_id, data.fecha, data.hora_entrada, data.hora_salida || null,
       data.empresa_id || null, data.nombre_evento, data.area,
       v.horasTrab, v.horasExtra, v.valor_horas_extra, v.valor_fijo, v.sueldo_total, id]);

  if (result.rowCount === 0) return null;
  return { id, ...data, ...v };
};

exports.eliminar = async (id) => {
  const result = await pool.query('DELETE FROM turnos WHERE id = $1', [id]);
  return result.rowCount > 0;
};

exports.duplicar = async (id, nuevaFecha) => {
  const { rows } = await pool.query('SELECT * FROM turnos WHERE id = $1', [id]);
  const original = rows[0];
  if (!original) return null;

  const data = {
    empleado_id: original.empleado_id,
    fecha: nuevaFecha,
    hora_entrada: original.hora_entrada,
    hora_salida: original.hora_salida,
    empresa_id: original.empresa_id,
    nombre_evento: original.nombre_evento,
    area: original.area,
  };

  return exports.crear(data);
};

exports.porEmpleado = async (empleadoId, { anio, mes, empresa_id, desde, hasta }) => {
  const usaRango = !!(desde && hasta);

  let sql = `
    SELECT t.id, t.empleado_id, t.fecha, t.hora_entrada, t.hora_salida,
           t.empresa_id, t.nombre_evento, t.area,
           t.horas_trabajadas, t.horas_extra, t.valor_horas_extra,
           t.valor_fijo, t.sueldo_total,
           e.nombre AS empresa_nombre
    FROM turnos t
    LEFT JOIN empresas e ON t.empresa_id = e.id
    WHERE t.empleado_id = $1
  `;
  const params = [empleadoId];
  let idx = 2;

  if (usaRango) {
    sql += ` AND t.fecha >= $${idx++} AND t.fecha <= $${idx++}`;
    params.push(desde, hasta);
  } else {
    const now = new Date();
    if (!anio) anio = String(now.getFullYear());
    if (!mes) mes = String(now.getMonth() + 1).padStart(2, '0');
    else mes = String(mes).padStart(2, '0');
    sql += ` AND LEFT(t.fecha, 7) = $${idx++}`;
    params.push(`${anio}-${mes}`);
  }

  if (empresa_id) {
    sql += ` AND t.empresa_id = $${idx++}`;
    params.push(empresa_id);
  }
  sql += ' ORDER BY t.fecha, t.hora_entrada';

  const { rows } = await pool.query(sql, params);
  return rows;
};

exports.global = async ({ desde, hasta, empleado_id, empresa_id }) => {
  let sql = `
    SELECT t.id, t.fecha, t.hora_entrada, t.hora_salida,
           t.nombre_evento, t.area,
           t.horas_trabajadas, t.horas_extra, t.valor_horas_extra,
           t.valor_fijo, t.sueldo_total,
           e.nombre AS empleado_nombre,
           emp.nombre AS empresa_nombre
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    WHERE 1 = 1
  `;
  const params = [];
  let idx = 1;

  if (desde && hasta) {
    sql += ` AND t.fecha >= $${idx++} AND t.fecha <= $${idx++}`;
    params.push(desde, hasta);
  }
  if (empleado_id) {
    sql += ` AND t.empleado_id = $${idx++}`;
    params.push(empleado_id);
  }
  if (empresa_id) {
    sql += ` AND t.empresa_id = $${idx++}`;
    params.push(empresa_id);
  }
  sql += ' ORDER BY t.fecha, t.hora_entrada';

  const { rows } = await pool.query(sql, params);
  return rows;
};
