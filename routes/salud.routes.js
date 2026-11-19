const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const logger = require('../utils/logger');
const { claveLimite } = require('../config/proxy');
const { crearSaludHandler } = require('../controllers/salud.controller');

// Público (lo consulta GitHub Actions sin credenciales) pero acotado: toca la base de datos.
const saludLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { estado: 'error', error: 'Demasiadas solicitudes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveLimite,
});

router.get('/salud', saludLimiter, crearSaludHandler(pool, { log: logger }));

module.exports = router;
