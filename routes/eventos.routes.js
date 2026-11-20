const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const v = require('../middlewares/validation.middleware');
const eventos = require('../controllers/eventos.controller');

router.use(verificarToken);

router.get('/eventos', v.eventoFiltrosValidator, eventos.listar);
router.get('/eventos/:id', v.idParam, v.handleErrors, eventos.obtener);
router.post('/eventos', v.eventoValidator, eventos.crear);
router.put('/eventos/:id', v.idParam, v.eventoValidator, eventos.actualizar);
router.delete('/eventos/:id', v.idParam, v.handleErrors, eventos.eliminar);

module.exports = router;
