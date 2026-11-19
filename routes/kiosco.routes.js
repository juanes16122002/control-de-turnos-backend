const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { marcarAsistenciaValidator } = require('../middlewares/validation.middleware');
const asistencia = require('../controllers/asistencia.controller');

// Rutas PÚBLICAS del kiosco de asistencia (sin JWT): el empleado se identifica con su PIN.
// El límite por IP es amplio porque un kiosco comparte IP entre todos los trabajadores
// (cambios de turno); la protección fuerte contra fuerza bruta es el bloqueo por empleado.
const marcarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas solicitudes desde este dispositivo. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/kiosco/empleados', asistencia.empleadosKiosco);
router.get('/kiosco/config', asistencia.configKiosco);
router.post('/kiosco/marcar', marcarLimiter, marcarAsistenciaValidator, asistencia.marcar);

module.exports = router;
