const { pool } = require('../db');
const AppError = require('../utils/AppError');
const { calcularParaEmpleado } = require('./sueldo.service');

exports.crear = async (data) => {
  const v = await calcularParaEmpleado(data.hora_entrada, data.hora_salida, data.empleado_id);
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
  const v = await calcularParaEmpleado(data.hora_entrada, data.hora_salida, data.empleado_id);
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)) {
    throw new AppError(400, 'Formato de fecha inválido. Usa YYYY-MM-DD');
  }

  const duplicado = await pool.query(`
    SELECT id FROM turnos
    WHERE empleado_id = $1 AND fecha = $2 AND hora_entrada = $3
      AND COALESCE(nombre_evento, '') = COALESCE($4, '')
      AND COALESCE(area, '') = COALESCE($5, '')
      AND COALESCE(empresa_id, 0) = COALESCE($6, 0)
  `, [original.empleado_id, nuevaFecha, original.hora_entrada,
       original.nombre_evento, original.area, original.empresa_id]);

  if (duplicado.rows.length > 0) {
    throw new AppError(409, 'Ya existe un turno idéntico para ese empleado en esa fecha');
  }

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
    SELECT t.id, t.empleado_id, to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
           t.hora_entrada, t.hora_salida,
           t.empresa_id, t.nombre_evento, t.area,
           t.horas_trabajadas, t.horas_extra, t.valor_horas_extra,
           t.valor_fijo, t.sueldo_total,
           e.nombre AS empresa_nombre,
           emp.tarifa_hora, emp.tarifa_hora_extra
    FROM turnos t
    JOIN empleados emp ON emp.id = t.empleado_id
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
    sql += ` AND to_char(t.fecha, 'YYYY-MM') = $${idx++}`;
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

function buildGlobalWhere({ desde, hasta, empleado_id, empresa_id }) {
  const params = [];
  let where = 'WHERE 1 = 1';
  let idx = 1;

  if (desde && hasta) {
    where += ` AND t.fecha >= $${idx++} AND t.fecha <= $${idx++}`;
    params.push(desde, hasta);
  }
  if (empleado_id) {
    where += ` AND t.empleado_id = $${idx++}`;
    params.push(empleado_id);
  }
  if (empresa_id) {
    where += ` AND t.empresa_id = $${idx++}`;
    params.push(empresa_id);
  }

  return { where, params };
}

const GLOBAL_FIELDS = `
    t.id, to_char(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora_entrada, t.hora_salida,
    t.nombre_evento, t.area,
    t.horas_trabajadas, t.horas_extra, t.valor_horas_extra,
    t.valor_fijo, t.sueldo_total,
    e.nombre AS empleado_nombre,
    emp.nombre AS empresa_nombre,
    e.tarifa_hora, e.tarifa_hora_extra
`;

exports.global = async (query) => {
  const { where, params } = buildGlobalWhere(query);

  const sql = `
    SELECT ${GLOBAL_FIELDS}
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    ${where}
    ORDER BY t.fecha, t.hora_entrada
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
};

exports.globalPaginado = async ({ page = 1, limit = 50, ...query }) => {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (page - 1) * limit;

  const { where, params } = buildGlobalWhere(query);

  const countParams = [...params];
  const { rows: [countRow] } = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COALESCE(SUM(t.horas_trabajadas), 0) AS total_horas_trabajadas,
           COALESCE(SUM(t.horas_extra), 0) AS total_horas_extra,
           COALESCE(SUM(t.valor_horas_extra), 0) AS total_valor_horas_extra,
           COALESCE(SUM(t.valor_fijo), 0) AS total_valor_fijo,
           COALESCE(SUM(t.sueldo_total), 0) AS total_sueldo
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    ${where}
  `, countParams);

  const { rows } = await pool.query(`
    SELECT ${GLOBAL_FIELDS}
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    ${where}
    ORDER BY t.fecha, t.hora_entrada
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return {
    data: rows,
    total: countRow.total,
    totales: {
      horasTrabajadas: countRow.total_horas_trabajadas,
      horasExtra: countRow.total_horas_extra,
      valorHorasExtra: countRow.total_valor_horas_extra,
      valorFijo: countRow.total_valor_fijo,
      sueldo: countRow.total_sueldo,
    },
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(countRow.total / limit)),
  };
};
