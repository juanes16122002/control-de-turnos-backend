const { body, validationResult } = require('express-validator');

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

const empleadoValidator = [
  body('nombre').trim().notEmpty().withMessage('El nombre del empleado es obligatorio'),
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

module.exports = { loginValidator, empleadoValidator, empresaValidator, turnoValidator };
