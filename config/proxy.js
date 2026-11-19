/**
 * Número de proxies de confianza delante del backend (valor de `trust proxy` en Express).
 * - TRUST_PROXY definido → se usa ese número (0 = sin proxy).
 * - Si no, en Railway (detectado por sus variables) → 1 salto.
 * - En otro caso → 0.
 */
function resolverSaltosProxy(env = process.env) {
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '') {
    const n = Number(env.TRUST_PROXY);
    if (!Number.isInteger(n) || n < 0 || n > 10) {
      throw new Error(`TRUST_PROXY inválido: "${env.TRUST_PROXY}". Usa un entero entre 0 y 10 (saltos de proxy)`);
    }
    return n;
  }
  if (env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT_NAME) return 1;
  return 0;
}

module.exports = { resolverSaltosProxy };
