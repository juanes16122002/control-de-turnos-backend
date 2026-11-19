const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const AppError = require('../utils/AppError');
const turnosService = require('./turnos.service');
const configuracionService = require('./configuracion.service');
const { evaluarUbicacion } = require('../helpers/geo');
const { formatearHora } = require('../helpers/tiempo');
const { validarRango, fechaLocal } = require('../helpers/asistencia');
const {
  ZONA_HORARIA,
  PIN_MAX_INTENTOS,
  PIN_BLOQUEO_MINUTOS,
  MINUTOS_MINIMOS_ENTRE_MARCAS,
  TOLERANCIA_FUTURO_MS,
} = require('../config/asistencia');

const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';

// Campos comunes de lectura. $1 siempre es la zona horaria.
const CAMPOS = `
  a.id, a.empleado_id, a.entrada, a.salida, a.origen_entrada, a.origen_salida,
  a.observacion, a.turno_id, a.created_at, a.updated_at,
  a.ubicacion_entrada, a.ubicacion_salida,
  e.nombre AS empleado_nombre,
  to_char((a.entrada AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha,
  (EXTRACT(EPOCH FROM (COALESCE(a.salida, NOW()) - a.entrada)) / 3600)::float8 AS horas
`;

function mapear(row) {
  if (!row) return row;
  return { ...row, horas: Number((row.horas || 0).toFixed(2)), abierta: row.salida == null };
}

async function obtenerPorId(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM asistencias a JOIN empleados e ON e.id = a.empleado_id WHERE a.id = $2`,
    [ZONA_HORARIA, id]
  );
  return mapear(rows[0]) || null;
}

async function obtenerAbierta(empleadoId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM asistencias a JOIN empleados e ON e.id = a.empleado_id
     WHERE a.empleado_id = $2 AND a.salida IS NULL`,
    [ZONA_HORARIA, empleadoId]
  );
  return mapear(rows[0]) || null;
}

function traducirErrorPg(err) {
  if (err.code === PG_UNIQUE_VIOLATION) {
    return new AppError(409, 'El empleado ya tiene una asistencia abierta (sin salida). Ciérrala antes de crear otra.');
  }
  if (err.code === PG_CHECK_VIOLATION) {
    return new AppError(400, 'La salida debe ser posterior a la entrada');
  }
  return err;
}

function describirMarca(valor) {
  return `${formatearHora(valor)} del ${fechaLocal(valor)}`;
}

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

exports.asignarPin = async (empleadoId, pin) => {
  const hash = await bcrypt.hash(pin, 10);
  const { rowCount } = await pool.query(
    `UPDATE empleados SET pin_hash = $1, pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = $2`,
    [hash, empleadoId]
  );
  return rowCount > 0;
};

exports.quitarPin = async (empleadoId) => {
  const { rowCount } = await pool.query(
    `UPDATE empleados SET pin_hash = NULL, pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = $1`,
    [empleadoId]
  );
  return rowCount > 0;
};

async function verificarPin(empleadoId, pin) {
  const { rows } = await pool.query(
    'SELECT id, nombre, pin_hash, pin_intentos, pin_bloqueado_hasta FROM empleados WHERE id = $1',
    [empleadoId]
  );
  const emp = rows[0];
  // Mismo mensaje para "no existe" y "PIN incorrecto": no revela qué falló
  if (!emp || !emp.pin_hash) throw new AppError(401, 'Empleado o PIN incorrecto');

  if (emp.pin_bloqueado_hasta && new Date(emp.pin_bloqueado_hasta) > new Date()) {
    const minutos = Math.ceil((new Date(emp.pin_bloqueado_hasta) - new Date()) / 60000);
    throw new AppError(429, `PIN bloqueado por demasiados intentos. Intenta en ${minutos} min o avisa al administrador.`);
  }

  const ok = await bcrypt.compare(pin, emp.pin_hash);
  if (!ok) {
    const { rows: [r] } = await pool.query(
      'UPDATE empleados SET pin_intentos = pin_intentos + 1 WHERE id = $1 RETURNING pin_intentos',
      [emp.id]
    );
    if (r.pin_intentos >= PIN_MAX_INTENTOS) {
      await pool.query(
        `UPDATE empleados SET pin_intentos = 0, pin_bloqueado_hasta = NOW() + make_interval(mins => $2) WHERE id = $1`,
        [emp.id, PIN_BLOQUEO_MINUTOS]
      );
      throw new AppError(429, `Demasiados intentos fallidos. PIN bloqueado por ${PIN_BLOQUEO_MINUTOS} minutos.`);
    }
    const restantes = PIN_MAX_INTENTOS - r.pin_intentos;
    throw new AppError(401, `Empleado o PIN incorrecto. Te quedan ${restantes} intento(s).`);
  }

  if (emp.pin_intentos > 0 || emp.pin_bloqueado_hasta) {
    await pool.query(
      'UPDATE empleados SET pin_intentos = 0, pin_bloqueado_hasta = NULL WHERE id = $1',
      [emp.id]
    );
  }
  return { id: emp.id, nombre: emp.nombre };
}

// ---------------------------------------------------------------------------
// Kiosco (público)
// ---------------------------------------------------------------------------

exports.empleadosKiosco = async () => {
  const { rows } = await pool.query(
    'SELECT id, nombre FROM empleados WHERE pin_hash IS NOT NULL ORDER BY nombre'
  );
  return rows;
};

exports.configKiosco = async () => {
  const g = await configuracionService.obtenerGeocerca();
  return { geocerca_activa: g.activa };
};

// Valida la ubicación contra la geocerca. Devuelve lo que se guarda en la asistencia.
async function validarUbicacion(ubicacion) {
  const geocerca = await configuracionService.obtenerGeocerca();
  const r = evaluarUbicacion(geocerca, ubicacion);
  if (!r.permitido) {
    const status = r.motivo === 'sin_ubicacion' ? 400 : 403;
    throw new AppError(status, r.mensaje);
  }
  if (!ubicacion) return null;
  return {
    lat: Number(ubicacion.lat.toFixed(6)),
    lng: Number(ubicacion.lng.toFixed(6)),
    precision_m: Number.isFinite(ubicacion.precision_m) ? Math.round(ubicacion.precision_m) : null,
    distancia_m: r.distancia_m ?? null,
  };
}

// Registra entrada o salida con la hora del SERVIDOR (no del dispositivo).
// La ubicación se valida DESPUÉS del PIN: sin PIN válido no se revela la distancia al local,
// y un rechazo por ubicación no cuenta como intento fallido de PIN.
exports.marcar = async ({ empleado_id, pin, tipo, ubicacion }) => {
  const empleado = await verificarPin(empleado_id, pin);
  const ubicacionValidada = await validarUbicacion(ubicacion);

  if (tipo === 'entrada') {
    try {
      const { rows } = await pool.query(
        `INSERT INTO asistencias (empleado_id, entrada, origen_entrada, ubicacion_entrada)
         VALUES ($1, NOW(), 'kiosco', $2) RETURNING id`,
        [empleado.id, ubicacionValidada]
      );
      return { tipo, empleado, asistencia: await obtenerPorId(rows[0].id) };
    } catch (err) {
      if (err.code === PG_UNIQUE_VIOLATION) {
        const abierta = await obtenerAbierta(empleado.id);
        throw new AppError(409, `Ya tienes una entrada registrada a las ${describirMarca(abierta.entrada)}. Marca tu salida primero.`);
      }
      throw err;
    }
  }

  // tipo === 'salida'
  const { rows } = await pool.query(
    `UPDATE asistencias
     SET salida = NOW(), origen_salida = 'kiosco', ubicacion_salida = $3, updated_at = NOW()
     WHERE empleado_id = $1 AND salida IS NULL
       AND entrada <= NOW() - make_interval(mins => $2)
     RETURNING id`,
    [empleado.id, MINUTOS_MINIMOS_ENTRE_MARCAS, ubicacionValidada]
  );

  if (rows.length === 0) {
    const abierta = await obtenerAbierta(empleado.id);
    if (abierta) {
      throw new AppError(409, 'Acabas de marcar tu entrada. Espera al menos un minuto para marcar la salida.');
    }
    throw new AppError(409, 'No tienes una entrada abierta. Marca tu entrada primero.');
  }

  return { tipo, empleado, asistencia: await obtenerPorId(rows[0].id) };
};

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------

function construirFiltros({ desde, hasta, empleado_id, estado }) {
  const params = [ZONA_HORARIA];
  const cond = [];
  if (desde) {
    params.push(desde);
    cond.push(`(a.entrada AT TIME ZONE $1)::date >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    cond.push(`(a.entrada AT TIME ZONE $1)::date <= $${params.length}`);
  }
  if (empleado_id) {
    params.push(empleado_id);
    cond.push(`a.empleado_id = $${params.length}`);
  }
  if (estado === 'abiertas') cond.push('a.salida IS NULL');
  if (estado === 'cerradas') cond.push('a.salida IS NOT NULL');
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

exports.listar = async ({ page = 1, limit = 50, ...filtros }) => {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const { where, params } = construirFiltros(filtros);

  // CTE con los mismos CAMPOS: reutiliza el cálculo de horas y siempre referencia $1
  const { rows: [resumen] } = await pool.query(`
    WITH f AS (
      SELECT ${CAMPOS}
      FROM asistencias a
      JOIN empleados e ON e.id = a.empleado_id
      ${where}
    )
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE salida IS NULL)::int AS abiertas,
           COALESCE(SUM(horas) FILTER (WHERE salida IS NOT NULL), 0)::float8 AS horas_cerradas
    FROM f
  `, params);

  const { rows } = await pool.query(`
    SELECT ${CAMPOS}
    FROM asistencias a
    JOIN empleados e ON e.id = a.empleado_id
    ${where}
    ORDER BY a.entrada DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, (page - 1) * limit]);

  return {
    data: rows.map(mapear),
    total: resumen.total,
    resumen: {
      abiertas: resumen.abiertas,
      horasCerradas: Number(resumen.horas_cerradas.toFixed(2)),
    },
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(resumen.total / limit)),
  };
};

exports.listarTodas = async (filtros) => {
  const { where, params } = construirFiltros(filtros);
  const { rows } = await pool.query(`
    SELECT ${CAMPOS}
    FROM asistencias a
    JOIN empleados e ON e.id = a.empleado_id
    ${where}
    ORDER BY a.entrada, e.nombre
  `, params);
  return rows.map(mapear);
};

exports.activas = async () => {
  const { rows } = await pool.query(`
    SELECT ${CAMPOS}
    FROM asistencias a
    JOIN empleados e ON e.id = a.empleado_id
    WHERE a.salida IS NULL
    ORDER BY a.entrada
  `, [ZONA_HORARIA]);
  return rows.map(mapear);
};

exports.crear = async ({ empleado_id, entrada, salida, observacion }) => {
  const errorRango = validarRango(entrada, salida, { toleranciaMs: TOLERANCIA_FUTURO_MS });
  if (errorRango) throw new AppError(400, errorRango);

  try {
    const { rows } = await pool.query(`
      INSERT INTO asistencias (empleado_id, entrada, salida, origen_entrada, origen_salida, observacion)
      VALUES ($1, $2, $3, 'admin', $4, $5)
      RETURNING id
    `, [empleado_id, entrada, salida || null, salida ? 'admin' : null, observacion || null]);
    return obtenerPorId(rows[0].id);
  } catch (err) {
    if (err.code === '23503') throw new AppError(404, 'Empleado no encontrado');
    throw traducirErrorPg(err);
  }
};

exports.actualizar = async (id, { entrada, salida, observacion }) => {
  const actual = await obtenerPorId(id);
  if (!actual) return null;
  if (actual.turno_id) {
    throw new AppError(409, 'Esta asistencia ya fue convertida en turno. Edita el turno o elimínalo primero.');
  }

  const errorRango = validarRango(entrada, salida, { toleranciaMs: TOLERANCIA_FUTURO_MS });
  if (errorRango) throw new AppError(400, errorRango);

  // Si el admin agrega/cambia la salida, queda registrado como corrección manual
  const salidaCambio = !actual.salida || !salida
    || new Date(salida).getTime() !== new Date(actual.salida).getTime();
  const origenSalida = salida ? (salidaCambio ? 'admin' : actual.origen_salida) : null;

  try {
    await pool.query(`
      UPDATE asistencias
      SET entrada = $1, salida = $2, origen_salida = $3, observacion = $4, updated_at = NOW()
      WHERE id = $5
    `, [entrada, salida || null, origenSalida, observacion ?? actual.observacion, id]);
  } catch (err) {
    throw traducirErrorPg(err);
  }
  return obtenerPorId(id);
};

exports.cerrar = async (id, { salida, observacion }) => {
  const actual = await obtenerPorId(id);
  if (!actual) return null;
  if (!actual.abierta) throw new AppError(409, 'La asistencia ya tiene salida registrada');
  const fin = salida || new Date().toISOString();
  return exports.actualizar(id, { entrada: actual.entrada, salida: fin, observacion });
};

exports.eliminar = async (id) => {
  const { rowCount } = await pool.query('DELETE FROM asistencias WHERE id = $1', [id]);
  return rowCount > 0;
};

// Crea un turno (con cálculo de sueldo) a partir de una asistencia cerrada.
// Transaccional: o se crea el turno y se vincula, o no pasa nada.
exports.convertirEnTurno = async (id, { nombre_evento, area, empresa_id }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, empleado_id, entrada, salida, turno_id,
             to_char((entrada AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha
      FROM asistencias WHERE id = $2 FOR UPDATE
    `, [ZONA_HORARIA, id]);
    const a = rows[0];

    if (!a) throw new AppError(404, 'Asistencia no encontrada');
    if (!a.salida) throw new AppError(409, 'La asistencia no tiene salida. Ciérrala antes de convertirla en turno.');
    if (a.turno_id) throw new AppError(409, 'Esta asistencia ya fue convertida en turno');

    const turno = await turnosService.crear({
      empleado_id: a.empleado_id,
      fecha: a.fecha,
      hora_entrada: a.entrada,
      hora_salida: a.salida,
      empresa_id: empresa_id || null,
      nombre_evento,
      area,
    }, client);

    await client.query(
      'UPDATE asistencias SET turno_id = $1, updated_at = NOW() WHERE id = $2',
      [turno.id, id]
    );
    await client.query('COMMIT');
    return { asistencia: await obtenerPorId(id), turno };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') throw new AppError(404, 'Empresa no encontrada');
    throw err;
  } finally {
    client.release();
  }
};
