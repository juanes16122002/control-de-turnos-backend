const asistenciaService = require('../services/asistencia.service');
const configuracionService = require('../services/configuracion.service');
const exportService = require('../services/export.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

// --- Kiosco (público) ---

exports.empleadosKiosco = catchAsync(async (req, res) => {
  res.json(await asistenciaService.empleadosKiosco());
});

exports.configKiosco = catchAsync(async (req, res) => {
  res.json(await asistenciaService.configKiosco());
});

exports.marcar = catchAsync(async (req, res) => {
  const { empleado_id, pin, tipo, ubicacion } = req.body;
  const ubic = ubicacion
    ? { lat: Number(ubicacion.lat), lng: Number(ubicacion.lng), precision_m: ubicacion.precision_m == null ? undefined : Number(ubicacion.precision_m) }
    : null;
  const resultado = await asistenciaService.marcar({ empleado_id: Number(empleado_id), pin, tipo, ubicacion: ubic });
  res.status(tipo === 'entrada' ? 201 : 200).json(resultado);
});

// --- Geocerca (admin) ---

exports.obtenerGeocerca = catchAsync(async (req, res) => {
  res.json(await configuracionService.obtenerGeocerca());
});

exports.guardarGeocerca = catchAsync(async (req, res) => {
  const { activa, lat, lng } = req.body;
  if (activa && (lat == null || lng == null || lat === '' || lng === '')) {
    throw new AppError(400, 'Para activar la geocerca debes indicar la ubicación del local (latitud y longitud)');
  }
  res.json(await configuracionService.guardarGeocerca(req.body));
});

// --- PIN (admin) ---

exports.asignarPin = catchAsync(async (req, res) => {
  if (!(await asistenciaService.asignarPin(Number(req.params.id), req.body.pin))) {
    throw new AppError(404, 'Empleado no encontrado');
  }
  res.json({ message: 'PIN asignado correctamente' });
});

exports.quitarPin = catchAsync(async (req, res) => {
  if (!(await asistenciaService.quitarPin(Number(req.params.id)))) {
    throw new AppError(404, 'Empleado no encontrado');
  }
  res.json({ message: 'PIN eliminado. El empleado ya no aparece en el kiosco.' });
});

// --- Asistencias (admin) ---

exports.listar = catchAsync(async (req, res) => {
  res.json(await asistenciaService.listar(req.query));
});

exports.activas = catchAsync(async (req, res) => {
  res.json(await asistenciaService.activas());
});

exports.crear = catchAsync(async (req, res) => {
  const { empleado_id, entrada, salida, observacion } = req.body;
  const asistencia = await asistenciaService.crear({ empleado_id: Number(empleado_id), entrada, salida, observacion });
  res.status(201).json(asistencia);
});

exports.actualizar = catchAsync(async (req, res) => {
  const { entrada, salida, observacion } = req.body;
  const asistencia = await asistenciaService.actualizar(Number(req.params.id), { entrada, salida, observacion });
  if (!asistencia) throw new AppError(404, 'Asistencia no encontrada');
  res.json(asistencia);
});

exports.cerrar = catchAsync(async (req, res) => {
  const { salida, observacion } = req.body || {};
  const asistencia = await asistenciaService.cerrar(Number(req.params.id), { salida, observacion });
  if (!asistencia) throw new AppError(404, 'Asistencia no encontrada');
  res.json(asistencia);
});

exports.eliminar = catchAsync(async (req, res) => {
  if (!(await asistenciaService.eliminar(Number(req.params.id)))) {
    throw new AppError(404, 'Asistencia no encontrada');
  }
  res.json({ message: 'Asistencia eliminada correctamente' });
});

exports.convertir = catchAsync(async (req, res) => {
  const { nombre_evento, area, empresa_id } = req.body;
  const resultado = await asistenciaService.convertirEnTurno(Number(req.params.id), { nombre_evento, area, empresa_id });
  res.status(201).json(resultado);
});

exports.excel = catchAsync(async (req, res) => {
  const rows = await asistenciaService.listarTodas(req.query);
  const workbook = exportService.generarExcelAsistencias(rows);
  const { desde, hasta } = req.query;
  const label = desde && hasta ? `${desde}_a_${hasta}` : 'completo';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=asistencias_${label}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});
