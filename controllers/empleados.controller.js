const empleadosService = require('../services/empleados.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

exports.listar = catchAsync(async (req, res) => {
  res.json(await empleadosService.listar());
});

exports.obtener = catchAsync(async (req, res) => {
  const empleado = await empleadosService.obtener(Number(req.params.id));
  if (!empleado) throw new AppError(404, 'Empleado no encontrado');
  res.json(empleado);
});

exports.crear = catchAsync(async (req, res) => {
  const { nombre, tarifa_hora, tarifa_hora_extra } = req.body;
  if (!nombre) throw new AppError(400, 'El nombre es obligatorio');
  const empleado = await empleadosService.crear(nombre, tarifa_hora, tarifa_hora_extra);
  res.status(201).json(empleado);
});

exports.actualizar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { nombre, tarifa_hora, tarifa_hora_extra } = req.body;

  if (!nombre && tarifa_hora === undefined && tarifa_hora_extra === undefined) {
    throw new AppError(400, 'Debes enviar al menos un campo para actualizar');
  }

  const data = {};
  if (nombre !== undefined) data.nombre = nombre.trim();
  if (tarifa_hora !== undefined) data.tarifa_hora = Number(tarifa_hora);
  if (tarifa_hora_extra !== undefined) data.tarifa_hora_extra = Number(tarifa_hora_extra);

  if (data.nombre !== undefined && !data.nombre) {
    throw new AppError(400, 'El nombre no puede estar vacío');
  }

  const empleado = await empleadosService.actualizar(Number(id), data);
  if (!empleado) throw new AppError(404, 'Empleado no encontrado');
  res.json(empleado);
});

exports.eliminar = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!(await empleadosService.eliminar(Number(id)))) {
    throw new AppError(404, 'Empleado no encontrado');
  }
  res.json({ message: 'Empleado eliminado correctamente' });
});
