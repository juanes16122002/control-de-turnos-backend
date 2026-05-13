const authService = require('../services/auth.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

exports.login = catchAsync(async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!authService.verificarCredenciales(usuario, contrasena)) {
    throw new AppError(401, 'Credenciales incorrectas');
  }

  const token = authService.generarToken(usuario);
  const refreshToken = await authService.generarRefreshToken(usuario);

  res.json({ token, refreshToken });
});

exports.refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError(400, 'Refresh token requerido');
  }

  const stored = await authService.verificarRefreshToken(refreshToken);
  if (!stored) {
    throw new AppError(401, 'Refresh token inválido o expirado');
  }

  await authService.eliminarRefreshToken(refreshToken);

  const newToken = authService.generarToken(stored.usuario);
  const newRefreshToken = await authService.generarRefreshToken(stored.usuario);

  res.json({ token: newToken, refreshToken: newRefreshToken });
});

exports.logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await authService.eliminarRefreshToken(refreshToken);
  }
  res.json({ message: 'Sesión cerrada correctamente' });
});

exports.perfil = (req, res) => {
  res.json({ message: 'Acceso autorizado', usuario: req.usuario });
};
