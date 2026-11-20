const eventosService = require('../services/eventos.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

function datosEvento(body) {
  return {
    nombre: body.nombre.trim(),
    empresa_id: Number(body.empresa_id),
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin || body.fecha_inicio,
    descripcion: body.descripcion?.trim() || null,
    empleados: body.empleados,
  };
}

exports.listar = catchAsync(async (req, res) => {
  res.json(await eventosService.listar(req.query));
});

exports.obtener = catchAsync(async (req, res) => {
  const evento = await eventosService.obtenerPorId(Number(req.params.id));
  if (!evento) throw new AppError(404, 'Evento no encontrado');
  res.json(evento);
});

exports.crear = catchAsync(async (req, res) => {
  res.status(201).json(await eventosService.crear(datosEvento(req.body)));
});

exports.actualizar = catchAsync(async (req, res) => {
  const evento = await eventosService.actualizar(Number(req.params.id), datosEvento(req.body));
  if (!evento) throw new AppError(404, 'Evento no encontrado');
  res.json(evento);
});

exports.eliminar = catchAsync(async (req, res) => {
  if (!(await eventosService.eliminar(Number(req.params.id)))) {
    throw new AppError(404, 'Evento no encontrado');
  }
  res.json({ message: 'Evento eliminado. Sus asistencias se conservan, ahora sin evento.' });
});
