const turnosService = require('../services/turnos.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

exports.crear = catchAsync(async (req, res) => {
  const { empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area } = req.body;

  if (!empleado_id || !fecha || !hora_entrada || !nombre_evento || !area) {
    throw new AppError(400, 'empleado_id, fecha, hora_entrada, nombre_evento y area son obligatorios');
  }

  const turno = await turnosService.crear({ empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area });
  res.status(201).json(turno);
});

exports.actualizar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area } = req.body;

  if (!empleado_id || !fecha || !hora_entrada || !nombre_evento || !area) {
    throw new AppError(400, 'empleado_id, fecha, hora_entrada, nombre_evento y area son obligatorios');
  }

  const turno = await turnosService.actualizar(Number(id), { empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area });
  if (!turno) throw new AppError(404, 'Turno no encontrado');
  res.json(turno);
});

exports.eliminar = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!(await turnosService.eliminar(Number(id)))) {
    throw new AppError(404, 'Turno no encontrado');
  }
  res.json({ message: 'Turno eliminado correctamente' });
});

exports.duplicar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.body;

  if (!fecha) throw new AppError(400, 'La fecha es obligatoria para duplicar el turno');

  const turno = await turnosService.duplicar(Number(id), fecha);
  if (!turno) throw new AppError(404, 'Turno original no encontrado');

  res.status(201).json(turno);
});

exports.porEmpleado = catchAsync(async (req, res) => {
  const rows = await turnosService.porEmpleado(req.params.id, req.query);
  res.json(rows);
});

exports.global = catchAsync(async (req, res) => {
  const rows = await turnosService.global(req.query);
  res.json(rows);
});
