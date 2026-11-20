const { body, param, query, validationResult } = require('express-validator');

const handleErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map((e) => e.msg).join('. ') });
  }
  next();
};

const loginValidator = [
  body('usuario').trim().notEmpty().withMessage('El usuario es obligatorio'),
  body('contrasena').trim().notEmpty().withMessage('La contraseña es obligatoria'),
  handleErrors,
];

const tarifaRule = (campo, nombre) => body(campo).optional({ values: 'falsy' })
  .isFloat({ min: 0, max: 10000000 }).withMessage(`La ${nombre} debe ser un número mayor o igual a 0`);

const empleadoValidator = [
  body('nombre').trim().notEmpty().withMessage('El nombre del técnico es obligatorio')
    .bail().isLength({ max: 200 }).withMessage('El nombre no puede superar 200 caracteres'),
  tarifaRule('tarifa_hora', 'tarifa por hora'),
  tarifaRule('tarifa_hora_extra', 'tarifa por hora extra'),
  handleErrors,
];

// Editar: todos los campos son opcionales, pero si vienen deben ser válidos
const empleadoActualizarValidator = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('nombre').optional().isString().trim().notEmpty().withMessage('El nombre no puede estar vacío')
    .bail().isLength({ max: 200 }).withMessage('El nombre no puede superar 200 caracteres'),
  tarifaRule('tarifa_hora', 'tarifa por hora'),
  tarifaRule('tarifa_hora_extra', 'tarifa por hora extra'),
  handleErrors,
];

const empresaValidator = [
  body('nombre').trim().notEmpty().withMessage('El nombre de la empresa es obligatorio'),
  handleErrors,
];

const turnoValidator = [
  body('empleado_id').isInt({ min: 1 }).withMessage('empleado_id es obligatorio y debe ser un número válido'),
  body('fecha').trim().notEmpty().withMessage('La fecha es obligatoria'),
  body('hora_entrada').trim().notEmpty().withMessage('La hora de entrada es obligatoria'),
  body('nombre_evento').trim().notEmpty().withMessage('El nombre del evento es obligatorio'),
  body('area').trim().notEmpty().withMessage('El área es obligatoria'),
  handleErrors,
];

// --- Asistencia ---
const PIN_REGEX = /^\d{4,6}$/;
const PIN_MSG = 'El PIN debe tener entre 4 y 6 dígitos numéricos';
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

const marcarAsistenciaValidator = [
  body('empleado_id').isInt({ min: 1 }).withMessage('Selecciona un técnico válido'),
  body('pin').isString().withMessage(PIN_MSG).bail().matches(PIN_REGEX).withMessage(PIN_MSG),
  body('tipo').isIn(['entrada', 'salida']).withMessage('El tipo debe ser "entrada" o "salida"'),
  body('ubicacion').optional({ values: 'null' }).isObject().withMessage('ubicacion inválida'),
  body('ubicacion.lat').if(body('ubicacion').exists({ values: 'null' }))
    .isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('ubicacion.lng').if(body('ubicacion').exists({ values: 'null' }))
    .isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
  body('ubicacion.precision_m').optional({ values: 'null' })
    .isFloat({ min: 0, max: 1000000 }).withMessage('Precisión inválida'),
  handleErrors,
];

const pinValidator = [
  idParam,
  body('pin').isString().withMessage(PIN_MSG).bail().matches(PIN_REGEX).withMessage(PIN_MSG),
  handleErrors,
];

const observacionRule = body('observacion').optional({ values: 'null' }).isString().trim()
  .isLength({ max: 500 }).withMessage('La observación no puede superar 500 caracteres');

// evento_id en asistencias: ausente = automático, null = sin evento, número = ese evento
const eventoIdAsistencia = body('evento_id').optional({ values: 'undefined' })
  .custom((v) => v === null || (Number.isInteger(Number(v)) && Number(v) > 0))
  .withMessage('evento_id inválido');

const fechaHora = (campo, nombre) => body(campo).isISO8601().withMessage(`La ${nombre} debe ser una fecha/hora válida`);
const fechaHoraOpcional = (campo, nombre) => body(campo).optional({ values: 'falsy' })
  .isISO8601().withMessage(`La ${nombre} debe ser una fecha/hora válida`);

const asistenciaCrearValidator = [
  body('empleado_id').isInt({ min: 1 }).withMessage('empleado_id es obligatorio'),
  fechaHora('entrada', 'entrada'),
  fechaHoraOpcional('salida', 'salida'),
  observacionRule,
  eventoIdAsistencia,
  handleErrors,
];

const asistenciaActualizarValidator = [
  idParam,
  fechaHora('entrada', 'entrada'),
  fechaHoraOpcional('salida', 'salida'),
  observacionRule,
  eventoIdAsistencia,
  handleErrors,
];

const asistenciaCerrarValidator = [
  idParam,
  fechaHoraOpcional('salida', 'salida'),
  observacionRule,
  handleErrors,
];

const convertirTurnoValidator = [
  idParam,
  // Si la asistencia tiene evento, el nombre se toma de él cuando no se envía
  body('nombre_evento').optional({ values: 'falsy' }).isString().trim(),
  body('area').isString().trim().notEmpty().withMessage('El área es obligatoria'),
  body('empresa_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('empresa_id inválido'),
  handleErrors,
];

const asistenciaFiltrosValidator = [
  query('desde').optional({ values: 'falsy' }).isISO8601().withMessage('"desde" debe ser YYYY-MM-DD'),
  query('hasta').optional({ values: 'falsy' }).isISO8601().withMessage('"hasta" debe ser YYYY-MM-DD'),
  query('empleado_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('empleado_id inválido'),
  query('estado').optional({ values: 'falsy' }).isIn(['abiertas', 'cerradas']).withMessage('estado inválido'),
  query('evento_id').optional({ values: 'falsy' })
    .custom((v) => v === 'ninguno' || (Number.isInteger(Number(v)) && Number(v) > 0)).withMessage('evento_id inválido'),
  query('empresa_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('empresa_id inválido'),
  handleErrors,
];

// --- Eventos ---
const fechaDia = (campo, msg) => body(campo).isISO8601({ strict: true }).withMessage(msg)
  .bail().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(msg);

const eventoValidator = [
  body('nombre').isString().trim().notEmpty().withMessage('El nombre del evento es obligatorio')
    .bail().isLength({ max: 200 }).withMessage('El nombre no puede superar 200 caracteres'),
  body('empresa_id').isInt({ min: 1 }).withMessage('Selecciona la empresa (productora) del evento'),
  fechaDia('fecha_inicio', 'La fecha de inicio debe tener formato YYYY-MM-DD'),
  body('fecha_fin').optional({ values: 'falsy' }).isISO8601({ strict: true })
    .withMessage('La fecha de término debe tener formato YYYY-MM-DD')
    .bail().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('La fecha de término debe tener formato YYYY-MM-DD')
    .bail().custom((fin, { req }) => !req.body.fecha_inicio || fin >= req.body.fecha_inicio)
    .withMessage('La fecha de término no puede ser anterior a la de inicio'),
  body('descripcion').optional({ values: 'null' }).isString().isLength({ max: 1000 })
    .withMessage('La descripción no puede superar 1000 caracteres'),
  body('empleados').optional().isArray({ max: 500 }).withMessage('"empleados" debe ser una lista de ids'),
  body('empleados.*').isInt({ min: 1 }).withMessage('Hay un técnico inválido en la lista'),
  handleErrors,
];

const eventoFiltrosValidator = [
  query('desde').optional({ values: 'falsy' }).isISO8601().withMessage('"desde" debe ser YYYY-MM-DD'),
  query('hasta').optional({ values: 'falsy' }).isISO8601().withMessage('"hasta" debe ser YYYY-MM-DD'),
  query('empresa_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('empresa_id inválido'),
  query('empleado_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('empleado_id inválido'),
  handleErrors,
];

const geocercaValidator = [
  body('activa').isBoolean().withMessage('"activa" debe ser verdadero o falso'),
  body('lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida (-90 a 90)'),
  body('lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida (-180 a 180)'),
  body('radio_m').isInt({ min: 20, max: 5000 }).withMessage('El radio debe estar entre 20 y 5000 metros'),
  body('precision_max_m').isInt({ min: 10, max: 5000 }).withMessage('La precisión máxima debe estar entre 10 y 5000 metros'),
  body('nombre').optional({ values: 'null' }).isString().isLength({ max: 120 }).withMessage('Nombre demasiado largo'),
  handleErrors,
];

module.exports = {
  geocercaValidator,
  loginValidator, empleadoValidator, empleadoActualizarValidator, empresaValidator, turnoValidator,
  marcarAsistenciaValidator, pinValidator, asistenciaCrearValidator, asistenciaActualizarValidator,
  asistenciaCerrarValidator, convertirTurnoValidator, asistenciaFiltrosValidator, idParam, handleErrors,
  eventoValidator, eventoFiltrosValidator,
};
