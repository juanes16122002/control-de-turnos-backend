const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { empresaValidator } = require('../middlewares/validation.middleware');
const empresas = require('../controllers/empresas.controller');

router.use(verificarToken);

router.get('/empresas', empresas.listar);
router.post('/empresas', empresaValidator, empresas.crear);
router.put('/empresas/:id', empresaValidator, empresas.actualizar);
router.delete('/empresas/:id', empresas.eliminar);

module.exports = router;
