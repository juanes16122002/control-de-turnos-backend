const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.status === 429) {
    return res.status(429).json({ error: err.message || 'Demasiadas solicitudes' });
  }

  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = errorHandler;
