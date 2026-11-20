const { pool } = require('../db');
const AppError = require('../utils/AppError');
const { ZONA_HORARIA } = require('../config/asistencia');

const PG_FK_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

// Subconsulta reutilizable: evento al que pertenece una marca de `empleadoSql` hecha en `momentoSql`.
// Es el evento asignado al empleado cuyo rango de fechas incluye el día local de la marca.
// Si hay varios el mismo día, gana el que empezó más recientemente.
// `zonaSql` es el parámetro con la zona horaria (p. ej. '$1').
function subconsultaEventoDe(empleadoSql, momentoSql, zonaSql) {
  return `(
    SELECT ev.id FROM eventos ev
    JOIN evento_empleados ee ON ee.evento_id = ev.id
    WHERE ee.empleado_id = ${empleadoSql}
      AND (${momentoSql} AT TIME ZONE ${zonaSql})::date BETWEEN ev.fecha_inicio AND ev.fecha_fin
    ORDER BY ev.fecha_inicio DESC, ev.id DESC
    LIMIT 1
  )`;
}

const CAMPOS = `
  ev.id, ev.nombre, ev.empresa_id, em.nombre AS empresa_nombre, ev.descripcion,
  to_char(ev.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
  to_char(ev.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
  ev.created_at, ev.updated_at,
  (SELECT COUNT(*)::int FROM evento_empleados ee WHERE ee.evento_id = ev.id) AS total_empleados,
  (SELECT COUNT(*)::int FROM asistencias a WHERE a.evento_id = ev.id) AS total_asistencias
`;

function normalizarEmpleados(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

function traducirErrorPg(err) {
  if (err.code === PG_FK_VIOLATION) {
    if (/empresa/.test(err.constraint || err.detail || '')) return new AppError(404, 'Empresa no encontrada');
    return new AppError(404, 'Alguno de los técnicos seleccionados no existe');
  }
  if (err.code === PG_CHECK_VIOLATION) {
    return new AppError(400, 'La fecha de término no puede ser anterior a la de inicio');
  }
  return err;
}

async function obtenerPorId(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM eventos ev JOIN empresas em ON em.id = ev.empresa_id WHERE ev.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const { rows: empleados } = await db.query(`
    SELECT e.id, e.nombre FROM evento_empleados ee
    JOIN empleados e ON e.id = ee.empleado_id
    WHERE ee.evento_id = $1 ORDER BY e.nombre
  `, [id]);
  return { ...rows[0], empleados };
}

// Reemplaza la lista de empleados asignados y mantiene coherentes las asistencias:
// - Asistencias ya marcadas (sin evento) de los asignados dentro de las fechas → quedan en este evento.
// - Asistencias de los empleados quitados del evento → quedan sin evento (salvo las ya convertidas en turno).
async function sincronizarEmpleados(client, eventoId, empleados) {
  const { rows: previos } = await client.query(
    'SELECT empleado_id FROM evento_empleados WHERE evento_id = $1', [eventoId]
  );
  const quitados = previos.map((r) => r.empleado_id).filter((id) => !empleados.includes(id));

  if (quitados.length > 0) {
    await client.query(
      'DELETE FROM evento_empleados WHERE evento_id = $1 AND empleado_id = ANY($2::int[])',
      [eventoId, quitados]
    );
    await client.query(`
      UPDATE asistencias SET evento_id = NULL, updated_at = NOW()
      WHERE evento_id = $1 AND empleado_id = ANY($2::int[]) AND turno_id IS NULL
    `, [eventoId, quitados]);
  }

  if (empleados.length > 0) {
    await client.query(`
      INSERT INTO evento_empleados (evento_id, empleado_id)
      SELECT $1, unnest($2::int[])
      ON CONFLICT DO NOTHING
    `, [eventoId, empleados]);
  }

  return asociarAsistenciasSinEvento(client, eventoId);
}

// Asocia al evento las asistencias sin evento de sus empleados que caen dentro de sus fechas
// (p. ej. alguien marcó antes de que el administrador lo asignara).
async function asociarAsistenciasSinEvento(client, eventoId) {
  const { rowCount } = await client.query(`
    UPDATE asistencias a SET evento_id = ev.id, updated_at = NOW()
    FROM eventos ev
    JOIN evento_empleados ee ON ee.evento_id = ev.id
    WHERE ev.id = $1
      AND a.empleado_id = ee.empleado_id
      AND a.evento_id IS NULL
      AND a.turno_id IS NULL
      AND (a.entrada AT TIME ZONE $2)::date BETWEEN ev.fecha_inicio AND ev.fecha_fin
  `, [eventoId, ZONA_HORARIA]);
  return rowCount;
}

async function enTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (err) {
    await client.query('ROLLBACK');
    throw traducirErrorPg(err);
  } finally {
    client.release();
  }
}

exports.subconsultaEventoDe = subconsultaEventoDe;
exports.normalizarEmpleados = normalizarEmpleados;
exports.obtenerPorId = (id) => obtenerPorId(id);

exports.listar = async ({ desde, hasta, empresa_id, empleado_id } = {}) => {
  const params = [];
  const cond = [];
  // Rango: eventos que se cruzan con [desde, hasta]
  if (desde) { params.push(desde); cond.push(`ev.fecha_fin >= $${params.length}`); }
  if (hasta) { params.push(hasta); cond.push(`ev.fecha_inicio <= $${params.length}`); }
  if (empresa_id) { params.push(empresa_id); cond.push(`ev.empresa_id = $${params.length}`); }
  if (empleado_id) {
    params.push(empleado_id);
    cond.push(`EXISTS (SELECT 1 FROM evento_empleados x WHERE x.evento_id = ev.id AND x.empleado_id = $${params.length})`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await pool.query(`
    SELECT ${CAMPOS}
    FROM eventos ev JOIN empresas em ON em.id = ev.empresa_id
    ${where}
    ORDER BY ev.fecha_inicio DESC, ev.id DESC
  `, params);
  return rows;
};

exports.crear = async ({ nombre, empresa_id, fecha_inicio, fecha_fin, descripcion, empleados }) => {
  const ids = normalizarEmpleados(empleados);
  return enTransaccion(async (client) => {
    const { rows } = await client.query(`
      INSERT INTO eventos (nombre, empresa_id, fecha_inicio, fecha_fin, descripcion)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [nombre, empresa_id, fecha_inicio, fecha_fin || fecha_inicio, descripcion || null]);
    const id = rows[0].id;
    const asociadas = await sincronizarEmpleados(client, id, ids);
    return { ...(await obtenerPorId(id, client)), asistencias_asociadas: asociadas };
  });
};

exports.actualizar = async (id, { nombre, empresa_id, fecha_inicio, fecha_fin, descripcion, empleados }) => {
  return enTransaccion(async (client) => {
    const { rowCount } = await client.query(`
      UPDATE eventos
      SET nombre = $1, empresa_id = $2, fecha_inicio = $3, fecha_fin = $4, descripcion = $5, updated_at = NOW()
      WHERE id = $6
    `, [nombre, empresa_id, fecha_inicio, fecha_fin || fecha_inicio, descripcion || null, id]);
    if (rowCount === 0) return null;

    // Si no se envía la lista, se conservan los asignados (solo se re-asocian por fechas nuevas)
    const asociadas = empleados === undefined
      ? await asociarAsistenciasSinEvento(client, id)
      : await sincronizarEmpleados(client, id, normalizarEmpleados(empleados));
    return { ...(await obtenerPorId(id, client)), asistencias_asociadas: asociadas };
  });
};

// Las asistencias del evento no se borran: quedan sin evento (ON DELETE SET NULL)
exports.eliminar = async (id) => {
  const { rowCount } = await pool.query('DELETE FROM eventos WHERE id = $1', [id]);
  return rowCount > 0;
};
