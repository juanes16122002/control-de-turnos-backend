const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verificarToken } = require('../middlewares/auth.middleware');
const { loginValidator } = require('../middlewares/validation.middleware');
const auth = require('../controllers/auth.controller');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, loginValidator, auth.login);
router.post('/refresh-token', auth.refresh);
router.post('/logout', auth.logout);
router.get('/perfil', verificarToken, auth.perfil);

module.exports = router;
