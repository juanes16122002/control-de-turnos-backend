const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const SENSITIVE_KEYS = ['contrasena', 'password', 'pass', 'token', 'refreshToken', 'authorization'];

function sanitizarBody(body) {
  if (!body || typeof body !== 'object') return body;
  const copy = { ...body };
  for (const key of SENSITIVE_KEYS) {
    if (key in copy) copy[key] = '[REDACTED]';
  }
  return copy;
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.status === 429) {
    return res.status(429).json({ error: err.message || 'Demasiadas solicitudes' });
  }

  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    body: sanitizarBody(req.body),
    params: req.params,
    query: req.query,
  });

  res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = errorHandler;
