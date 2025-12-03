// routes/auth.routes.js
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const SECRET = 'mi_secreto';

// Login
router.post('/login', (req, res) => {
  const { usuario, contrasena } = req.body;

  if (usuario === 'admin' && contrasena === '1234') {
    const token = jwt.sign({ usuario }, SECRET, { expiresIn: '1h' });
    return res.json({ token });
  }

  res.status(401).json({ message: 'Credenciales incorrectas' });
});

// Middleware local
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ message: 'No token provided' });
  }

  const [, token] = authHeader.split(' ');

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(500).json({ message: 'Invalid token' });
    }
    req.usuario = decoded.usuario;
    next();
  });
};

// Ejemplo de ruta protegida
router.get('/perfil', verificarToken, (req, res) => {
  res.json({ message: 'Acceso autorizado', usuario: req.usuario });
});

module.exports = router;
