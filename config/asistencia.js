module.exports = {
  // Zona horaria de la empresa: define a qué "día" pertenece una marca
  ZONA_HORARIA: process.env.ZONA_HORARIA || 'America/Santiago',
  // Bloqueo del PIN tras N intentos fallidos
  PIN_MAX_INTENTOS: 5,
  PIN_BLOQUEO_MINUTOS: 15,
  // Evita marcar la salida por error justo después de la entrada
  MINUTOS_MINIMOS_ENTRE_MARCAS: 1,
  // Tolerancia para fechas futuras en correcciones manuales (desfase de relojes)
  TOLERANCIA_FUTURO_MS: 5 * 60 * 1000,
};
