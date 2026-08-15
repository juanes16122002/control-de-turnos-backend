const { pool } = require('../db');
const { calcularHorasBaseYExtra } = require('../helpers/tiempo');
const { TARIFA_HORA, TARIFA_HORA_EXTRA } = require('../config/tarifas');

function calcular({ horaEntrada, horaSalida, tarifaHora = TARIFA_HORA, tarifaHoraExtra = TARIFA_HORA_EXTRA }) {
  const { base, extra } = calcularHorasBaseYExtra(horaEntrada, horaSalida);
  const horasTrab = base || 0;
  const horasExtra = extra || 0;
  const valor_fijo = horasTrab * tarifaHora;
  const valor_horas_extra = horasExtra * tarifaHoraExtra;

  return {
    horasTrab,
    horasExtra,
    valor_fijo,
    valor_horas_extra,
    sueldo_total: valor_fijo + valor_horas_extra,
  };
}

async function calcularParaEmpleado(horaEntrada, horaSalida, empleadoId) {
  let tarifaHora = TARIFA_HORA;
  let tarifaHoraExtra = TARIFA_HORA_EXTRA;

  if (empleadoId) {
    const { rows } = await pool.query(
      'SELECT tarifa_hora, tarifa_hora_extra FROM empleados WHERE id = $1',
      [empleadoId]
    );
    const emp = rows[0];
    if (emp) {
      if (emp.tarifa_hora != null) tarifaHora = emp.tarifa_hora;
      if (emp.tarifa_hora_extra != null) tarifaHoraExtra = emp.tarifa_hora_extra;
    }
  }

  return calcular({ horaEntrada, horaSalida, tarifaHora, tarifaHoraExtra });
}

module.exports = { calcular, calcularParaEmpleado };
