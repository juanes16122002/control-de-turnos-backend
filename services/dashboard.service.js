const { pool } = require('../db');

const now = new Date();
const anioActual = now.getFullYear();
const mesActual = String(now.getMonth() + 1).padStart(2, '0');
const mesActualNum = now.getMonth() + 1;

async function obtenerTurnosEsteMes() {
  const { rows } = await pool.query(`
    SELECT t.*, e.nombre AS empleado_nombre, emp.nombre AS empresa_nombre
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    WHERE to_char(t.fecha, 'YYYY-MM') = $1
    ORDER BY t.fecha DESC
  `, [`${anioActual}-${mesActual}`]);
  return rows;
}

exports.stats = async () => {
  const [totalEmpleados, totalEmpresas, totalTurnos, turnosEsteMes, turnosPorEmpleado, turnosPorEmpresa, turnosRecientes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM empleados').then(r => r.rows[0].count),
    pool.query('SELECT COUNT(*)::int AS count FROM empresas').then(r => r.rows[0].count),
    pool.query('SELECT COUNT(*)::int AS count FROM turnos').then(r => r.rows[0].count),
    obtenerTurnosEsteMes(),
    pool.query(`
      SELECT e.id, e.nombre, COUNT(t.id)::int AS total_turnos,
             COALESCE(SUM(t.horas_trabajadas), 0) AS total_horas,
             COALESCE(SUM(t.sueldo_total), 0) AS total_sueldo
      FROM empleados e
      LEFT JOIN turnos t ON t.empleado_id = e.id AND to_char(t.fecha, 'YYYY-MM') = $1
      GROUP BY e.id
      ORDER BY total_horas DESC
    `, [`${anioActual}-${mesActual}`]).then(r => r.rows),
    pool.query(`
      SELECT emp.id, emp.nombre, COUNT(t.id)::int AS total
      FROM empresas emp
      LEFT JOIN turnos t ON t.empresa_id = emp.id AND to_char(t.fecha, 'YYYY-MM') = $1
      GROUP BY emp.id
      ORDER BY total DESC
    `, [`${anioActual}-${mesActual}`]).then(r => r.rows),
    pool.query(`
      SELECT to_char(t.fecha, 'YYYY-MM-DD') AS fecha, t.nombre_evento, e.nombre AS empleado_nombre,
             emp.nombre AS empresa_nombre, t.horas_trabajadas, t.sueldo_total
      FROM turnos t
      JOIN empleados e ON t.empleado_id = e.id
      LEFT JOIN empresas emp ON t.empresa_id = emp.id
      ORDER BY t.id DESC
      LIMIT 5
    `).then(r => r.rows),
  ]);

  const totalHorasEsteMes = turnosEsteMes.reduce((sum, t) => {
    return sum + (t.horas_trabajadas || 0);
  }, 0);

  const totalSueldoEsteMes = turnosEsteMes.reduce((sum, t) => {
    return sum + (t.sueldo_total || 0);
  }, 0);

  const totalHorasExtraEsteMes = turnosEsteMes.reduce((sum, t) => {
    return sum + (t.horas_extra || 0);
  }, 0);

  return {
    totalEmpleados,
    totalEmpresas,
    totalTurnos,
    periodoActual: `${anioActual}-${mesActual}`,
    turnosEsteMes: turnosEsteMes.length,
    totalHorasEsteMes: Number(totalHorasEsteMes.toFixed(2)),
    totalHorasExtraEsteMes: Number(totalHorasExtraEsteMes.toFixed(2)),
    totalSueldoEsteMes,
    topEmpleados: turnosPorEmpleado,
    turnosPorEmpresa,
    turnosRecientes,
  };
};
