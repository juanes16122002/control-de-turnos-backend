// helpers/tiempo.js

// Calcula horas base (máx 8) y horas extra
function calcularHorasBaseYExtra(horaEntrada, horaSalida) {
  if (!horaEntrada || !horaSalida) {
    return { base: 0, extra: 0 };
  }

  const ini = new Date(horaEntrada);
  let fin = new Date(horaSalida);

  // Si la salida es <= entrada, asumimos que cruzó la medianoche
  if (fin <= ini) {
    fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
  }

  const diffMs = fin - ini;
  if (diffMs <= 0) {
    return { base: 0, extra: 0 };
  }

  const horas = diffMs / (1000 * 60 * 60); // horas decimales
  const base = Math.min(horas, 8);
  const extra = Math.max(horas - base, 0);

  return {
    base: Number(base.toFixed(2)),
    extra: Number(extra.toFixed(2)),
  };
}

// Formatea la hora en formato HH:mm, SIEMPRE en horario de Chile
function formatearHora(isoString) {
  if (!isoString) return '';

  const d = new Date(isoString);

  return d.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago', // <--- clave
  });
}

module.exports = {
  calcularHorasBaseYExtra,
  formatearHora,
};
