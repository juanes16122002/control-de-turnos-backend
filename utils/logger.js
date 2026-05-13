const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const prefix = `${timestamp} [${level.toUpperCase()}]`;
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return stack
        ? `${prefix} ${message}\n${stack}${metaStr}`
        : `${prefix} ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, stack }) =>
          stack ? `${timestamp} ${level} ${message}\n${stack}` : `${timestamp} ${level} ${message}`
        )
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '..', 'logs', 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '..', 'logs', 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
