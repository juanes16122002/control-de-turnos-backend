const empresasService = require('../services/empresas.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

exports.listar = catchAsync(async (req, res) => {
  res.json(await empresasService.listar());
});

exports.crear = catchAsync(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) throw new AppError(400, 'El nombre es obligatorio');
  const empresa = await empresasService.crear(nombre);
  res.status(201).json(empresa);
});

exports.actualizar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) throw new AppError(400, 'El nombre es obligatorio');
  const empresa = await empresasService.actualizar(Number(id), nombre.trim());
  if (!empresa) throw new AppError(404, 'Empresa no encontrada');
  res.json(empresa);
});

exports.eliminar = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!(await empresasService.eliminar(Number(id)))) {
    throw new AppError(404, 'Empresa no encontrada');
  }
  res.json({ message: 'Empresa eliminada correctamente' });
});
