// Chequeo de salud con consulta real a la base de datos.
// Lo usa la tarea programada que mantiene despierto el backend: además de evitar que Render apague
// el servicio, genera actividad diaria en la base para que Supabase (plan gratuito) no pause el
// proyecto por inactividad (se pausa tras ~7 días sin actividad en la base de datos).
const TIMEOUT_MS = 5000;

function conTimeout(promesa, ms) {
  let t;
  const limite = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(t));
}

/**
 * Crea el handler de /salud. Recibe el pool para poder probarlo con un pool simulado.
 * Respuestas: 200 { estado: 'ok', db: 'ok', ms } · 503 { estado: 'error', db: 'sin conexión' | 'sin respuesta' }.
 * Nunca expone el mensaje de error de la base (podría revelar host, usuario, etc.).
 */
function crearSaludHandler(pool, { timeoutMs = TIMEOUT_MS, log = console } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const t0 = Date.now();
    try {
      await conTimeout(pool.query('SELECT 1'), timeoutMs);
      res.json({ estado: 'ok', db: 'ok', ms: Date.now() - t0 });
    } catch (err) {
      const sinRespuesta = err.message === 'timeout';
      log.error(`[salud] Base de datos ${sinRespuesta ? 'sin respuesta' : 'con error'}: ${err.message}`);
      res.status(503).json({ estado: 'error', db: sinRespuesta ? 'sin respuesta' : 'sin conexión' });
    }
  };
}

module.exports = { crearSaludHandler };
