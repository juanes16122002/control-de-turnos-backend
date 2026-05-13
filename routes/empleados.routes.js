const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { empleadoValidator } = require('../middlewares/validation.middleware');
const empleados = require('../controllers/empleados.controller');

router.use(verificarToken);

router.get('/empleados', empleados.listar);
router.get('/empleados/:id', empleados.obtener);
router.post('/empleados', empleadoValidator, empleados.crear);
router.put('/empleados/:id', empleados.actualizar);
router.delete('/empleados/:id', empleados.eliminar);

module.exports = router;
