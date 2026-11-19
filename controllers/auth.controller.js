const authService = require('../services/auth.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

exports.login = catchAsync(async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!(await authService.verificarCredenciales(usuario, contrasena))) {
    throw new AppError(401, 'Credenciales incorrectas');
  }

  const token = authService.generarToken(usuario);
  const refreshToken = await authService.crearSesion(usuario);

  res.json({ token, refreshToken });
});

exports.refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new AppError(400, 'Refresh token requerido');
  }

  const { usuario, refreshToken: nuevoRefresh } = await authService.rotarRefreshToken(refreshToken);
  res.json({ token: authService.generarToken(usuario), refreshToken: nuevoRefresh });
});

exports.logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    await authService.revocarSesion(refreshToken);
  }
  res.json({ message: 'Sesión cerrada correctamente' });
});

exports.perfil = (req, res) => {
  res.json({ message: 'Acceso autorizado', usuario: req.usuario });
};
