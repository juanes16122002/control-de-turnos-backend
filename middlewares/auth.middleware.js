const jwt = require('jsonwebtoken');
const { JWT_ALGORITMO } = require('../config/auth');

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Formato de token inválido' });
  }

  try {
    // Algoritmo fijado: no se acepta ningún otro aunque el token lo declare
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITMO] });
    req.usuario = decoded.usuario;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = { verificarToken };
