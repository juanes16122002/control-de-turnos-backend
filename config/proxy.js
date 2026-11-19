const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Número de proxies de confianza delante del backend (valor de `trust proxy` en Express).
 * - TRUST_PROXY definido → se usa ese número (0 = sin proxy).
 * - Si no, en Railway o Render (detectados por sus variables) → 1 salto.
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
  if (env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT_NAME || esRender(env)) return 1;
  return 0;
}

// Render define RENDER=true en todos sus servicios
function esRender(env = process.env) {
  return env.RENDER === 'true';
}

/**
 * IP del cliente para los límites de intentos.
 * En Render todo el tráfico entra por Cloudflare, que escribe CF-Connecting-IP con la IP real
 * (sobrescribiendo cualquier valor que mande el cliente). X-Forwarded-For, en cambio, se
 * concatena y su parte izquierda la controla el cliente, así que no sirve para esto.
 * Fuera de Render se usa req.ip (que respeta `trust proxy`).
 */
function ipCliente(req, env = process.env) {
  if (esRender(env)) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
  }
  return req.ip;
}

// keyGenerator para express-rate-limit: agrupa IPv6 por subred (/56) para evitar evasión
function claveLimite(req) {
  return ipKeyGenerator(ipCliente(req));
}

module.exports = { resolverSaltosProxy, esRender, ipCliente, claveLimite };
