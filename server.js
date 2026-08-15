require('dotenv').config();

const REQUIRED_ENV = ['JWT_SECRET', 'ADMIN_PASS'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Faltan variables de entorno obligatorias: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const logger = require('./utils/logger');
const { pool, initDb } = require('./db');

const authRoutes = require('./routes/auth.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const empresasRoutes = require('./routes/empresas.routes');
const turnosRoutes = require('./routes/turnos.routes');
const exportEmpleadoRoutes = require('./routes/exportEmpleado.routes');
const exportGlobalRoutes = require('./routes/exportGlobal.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const errorHandler = require('./middlewares/errorHandler');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
}));
app.use(express.json());

const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan('[:method] :url :status :response-time ms', { stream: morganStream }));

app.get('/', (req, res) => {
  res.json({ message: 'API de Registro de Horarios', version: '1.0.0' });
});

app.use(authRoutes);
app.use(empleadosRoutes);
app.use(empresasRoutes);
app.use(turnosRoutes);
app.use(exportEmpleadoRoutes);
app.use(exportGlobalRoutes);
app.use(dashboardRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    logger.info('Base de datos inicializada');
    app.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`);
      logger.info(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    });
  })
  .catch((err) => {
    logger.error('Error al inicializar la base de datos:', err);
    process.exit(1);
  });

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} recibido. Cerrando servidor...`);
  try {
    await pool.end();
    logger.info('Pool de base de datos cerrado');
    process.exit(0);
  } catch (err) {
    logger.error('Error al cerrar el pool:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
