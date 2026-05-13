const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const exportEmpleado = require('../controllers/exportEmpleado.controller');

router.use(verificarToken);

router.get('/empleados/:id/turnos/excel', exportEmpleado.excel);
router.get('/empleados/:id/turnos/pdf', exportEmpleado.pdf);

module.exports = router;
