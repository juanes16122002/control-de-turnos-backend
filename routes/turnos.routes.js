const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { turnoValidator } = require('../middlewares/validation.middleware');
const turnos = require('../controllers/turnos.controller');

router.use(verificarToken);

router.post('/turnos', turnoValidator, turnos.crear);
router.put('/turnos/:id', turnoValidator, turnos.actualizar);
router.delete('/turnos/:id', turnos.eliminar);
router.post('/turnos/:id/duplicar', turnos.duplicar);
router.get('/empleados/:id/turnos', turnos.porEmpleado);
router.get('/turnos', turnos.global);

module.exports = router;
