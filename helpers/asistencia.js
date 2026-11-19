const { ZONA_HORARIA } = require('../config/asistencia');

const PIN_REGEX = /^\d{4,6}$/;

function pinValido(pin) {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

// Duración en horas decimales (2 decimales). Si no hay salida, usa `ahora`.
function calcularDuracionHoras(entrada, salida, ahora = new Date()) {
  if (!entrada) return 0;
  const ini = new Date(entrada);
  const fin = salida ? new Date(salida) : ahora;
  const diff = fin - ini;
  if (!(diff > 0)) return 0;
  return Number((diff / 3600000).toFixed(2));
}

// Fecha local (YYYY-MM-DD) en la zona horaria de la empresa
function fechaLocal(valor, zona = ZONA_HORARIA) {
  if (!valor) return '';
  return new Date(valor).toLocaleDateString('en-CA', { timeZone: zona });
}

// Valida un rango entrada/salida para correcciones manuales.
// Devuelve un mensaje de error o null si es válido.
function validarRango(entrada, salida, { ahora = new Date(), toleranciaMs = 0 } = {}) {
  const ini = new Date(entrada);
  if (Number.isNaN(ini.getTime())) return 'La fecha/hora de entrada no es válida';
  const limite = ahora.getTime() + toleranciaMs;
  if (ini.getTime() > limite) return 'La entrada no puede estar en el futuro';

  if (salida) {
    const fin = new Date(salida);
    if (Number.isNaN(fin.getTime())) return 'La fecha/hora de salida no es válida';
    if (fin <= ini) return 'La salida debe ser posterior a la entrada';
    if (fin.getTime() > limite) return 'La salida no puede estar en el futuro';
  }
  return null;
}

module.exports = { pinValido, calcularDuracionHoras, fechaLocal, validarRango, PIN_REGEX };
