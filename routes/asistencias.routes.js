const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const v = require('../middlewares/validation.middleware');
const asistencia = require('../controllers/asistencia.controller');

router.use(verificarToken);

// Geocerca: ubicación del local y radio permitido para marcar
router.get('/configuracion/geocerca', asistencia.obtenerGeocerca);
router.put('/configuracion/geocerca', v.geocercaValidator, asistencia.guardarGeocerca);

// PIN del kiosco por empleado
router.put('/empleados/:id/pin', v.pinValidator, asistencia.asignarPin);
router.delete('/empleados/:id/pin', v.idParam, v.handleErrors, asistencia.quitarPin);

// Asistencias (las rutas fijas van antes de /:id)
router.get('/asistencias', v.asistenciaFiltrosValidator, asistencia.listar);
router.get('/asistencias/activas', asistencia.activas);
router.get('/asistencias/excel', v.asistenciaFiltrosValidator, asistencia.excel);
router.post('/asistencias', v.asistenciaCrearValidator, asistencia.crear);
router.put('/asistencias/:id', v.asistenciaActualizarValidator, asistencia.actualizar);
router.post('/asistencias/:id/cerrar', v.asistenciaCerrarValidator, asistencia.cerrar);
router.post('/asistencias/:id/convertir', v.convertirTurnoValidator, asistencia.convertir);
router.delete('/asistencias/:id', v.idParam, v.handleErrors, asistencia.eliminar);

module.exports = router;
