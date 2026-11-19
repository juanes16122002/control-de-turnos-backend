const fs = require('fs');

const URL_LOCAL_POR_DEFECTO = 'postgresql://postgres:postgres@localhost:5432/turnos';

// Parámetros SSL de la URL que `pg` aplicaría por encima de la opción `ssl`
// (p. ej. Supabase sugiere `?sslmode=require`). Se quitan para controlar el SSL aquí.
const PARAMS_SSL = ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

function esSupabase(host) {
  return /\.supabase\.(co|com)$/i.test(host || '');
}

function esPoolerTransaccional(url) {
  return esSupabase(url.hostname) && url.port === '6543';
}

// Lee el CA desde DB_SSL_CA (contenido PEM) o DB_SSL_CA_PATH (ruta a archivo)
function leerCA(env) {
  if (env.DB_SSL_CA) return env.DB_SSL_CA.replace(/\\n/g, '\n');
  if (env.DB_SSL_CA_PATH) return fs.readFileSync(env.DB_SSL_CA_PATH, 'utf8');
  return null;
}

/**
 * Construye la configuración del Pool de pg a partir de las variables de entorno.
 *
 * SSL (DB_SSL):
 *  - "verify"  → cifra y verifica el certificado con el CA de DB_SSL_CA / DB_SSL_CA_PATH (recomendado en producción)
 *  - "require" → cifra sin verificar el certificado
 *  - "disable" → sin SSL (Postgres local / docker)
 *  - sin definir → automático: "verify" si hay CA, "require" si el host es de Supabase, "disable" en otro caso
 */
function construirConfigPool(env = process.env, { leerCertificado = leerCA } = {}) {
  const url = new URL(env.DATABASE_URL || URL_LOCAL_POR_DEFECTO);
  PARAMS_SSL.forEach((p) => url.searchParams.delete(p));

  const ca = leerCertificado(env);
  let modo = (env.DB_SSL || '').toLowerCase();
  if (!modo) modo = ca ? 'verify' : esSupabase(url.hostname) ? 'require' : 'disable';

  let ssl = false;
  if (modo === 'verify') {
    if (!ca) throw new Error('DB_SSL=verify requiere DB_SSL_CA o DB_SSL_CA_PATH con el certificado CA');
    ssl = { ca, rejectUnauthorized: true };
  } else if (modo === 'require') {
    ssl = { rejectUnauthorized: false };
  } else if (modo !== 'disable') {
    throw new Error(`DB_SSL inválido: "${env.DB_SSL}". Usa verify, require o disable`);
  }

  return {
    connectionString: url.toString(),
    ssl,
    // Supabase limita las conexiones según el plan: un pool chico y que libere conexiones ociosas
    max: Number(env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Identifica las conexiones del backend en el panel de Supabase (pg_stat_activity)
    application_name: 'turnos-backend',
    // Metadatos para logs (no son opciones de pg)
    _info: {
      host: url.hostname,
      puerto: url.port || '5432',
      sslModo: modo,
      supabase: esSupabase(url.hostname),
      poolerTransaccional: esPoolerTransaccional(url),
    },
  };
}

module.exports = { construirConfigPool, esSupabase };
