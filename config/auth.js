// Política de sesión del panel de administración.
const num = (v, porDefecto) => (v !== undefined && v !== '' && Number(v) > 0 ? Number(v) : porDefecto);

module.exports = {
  // Token de acceso (JWT): corto, porque no se puede revocar antes de que venza
  ACCESS_TTL: process.env.JWT_EXPIRES_IN || '15m',
  JWT_ALGORITMO: 'HS256',
  // Token de renovación: vence si no se usa en este tiempo (inactividad)...
  REFRESH_INACTIVIDAD_HORAS: num(process.env.REFRESH_IDLE_HOURS, 12),
  // ...y la sesión completa no puede durar más que esto desde el login
  SESION_MAX_DIAS: num(process.env.SESSION_MAX_DAYS, 7),
  // Margen para que dos pestañas renueven a la vez con el mismo token sin que
  // se considere robo. Pasado este margen, reusar un token cierra toda la sesión.
  GRACIA_REUSO_SEGUNDOS: 30,
};
