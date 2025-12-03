// helpers/tiempo.js

// Formatea una fecha/hora ISO a "HH:MM"
function formatearHora(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().substring(11, 16);
  } catch {
    return '';
  }
}

// Calcula horas base (máx 8) y horas extra, soportando cruces de medianoche
function calcularHorasBaseYExtra(horaEntrada, horaSalida) {
  if (!horaEntrada || !horaSalida) {
    return { base: null, extra: null, total: null };
  }

  const ini = new Date(horaEntrada);
  let fin = new Date(horaSalida);

  // Si la salida es menor o igual a la entrada, asumimos que salió al día siguiente
  if (fin <= ini) {
    fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
  }

  const diffMs = fin - ini;
  const totalHoras = diffMs / (1000 * 60 * 60);

  if (totalHoras <= 0) {
    return { base: null, extra: null, total: null };
  }

  const base = Math.min(totalHoras, 8);
  const extra = Math.max(totalHoras - 8, 0);

  return {
    base: Number(base.toFixed(2)),
    extra: Number(extra.toFixed(2)),
    total: Number(totalHoras.toFixed(2)),
  };
}

module.exports = {
  formatearHora,
  calcularHorasBaseYExtra,
};
