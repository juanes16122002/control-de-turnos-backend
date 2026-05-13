const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const dashboard = require('../controllers/dashboard.controller');

router.use(verificarToken);

router.get('/dashboard', dashboard.stats);

module.exports = router;
