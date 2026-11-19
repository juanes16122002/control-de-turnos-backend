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
const { pool, initDb, infoConexion } = require('./db');

const authRoutes = require('./routes/auth.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const empresasRoutes = require('./routes/empresas.routes');
const turnosRoutes = require('./routes/turnos.routes');
const exportEmpleadoRoutes = require('./routes/exportEmpleado.routes');
const exportGlobalRoutes = require('./routes/exportGlobal.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const kioscoRoutes = require('./routes/kiosco.routes');
const asistenciasRoutes = require('./routes/asistencias.routes');
const errorHandler = require('./middlewares/errorHandler');
const { resolverSaltosProxy } = require('./config/proxy');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();

// Detrás de un proxy (Railway, nginx, etc.) la IP real del cliente viene en X-Forwarded-For.
// Sin esto, todos los usuarios comparten la IP del proxy y los límites de intentos
// (login, kiosco) se vuelven globales. Solo se confía en el número de saltos indicado:
// sin proxy delante debe ser 0, o un cliente podría falsificar su IP con esa cabecera.
const saltosProxy = resolverSaltosProxy(process.env);
app.set('trust proxy', saltosProxy);

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
// Rutas públicas: deben ir ANTES de los routers protegidos, porque estos aplican
// verificarToken con router.use() a toda petición que pase por ellos.
app.use(kioscoRoutes);
app.use(empleadosRoutes);
app.use(empresasRoutes);
app.use(turnosRoutes);
app.use(exportEmpleadoRoutes);
app.use(exportGlobalRoutes);
app.use(dashboardRoutes);
app.use(asistenciasRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    logger.info(`Base de datos inicializada (${infoConexion.supabase ? 'Supabase' : 'PostgreSQL'} ${infoConexion.host}:${infoConexion.puerto}, SSL: ${infoConexion.sslModo})`);
    if (infoConexion.sslModo === 'require') {
      logger.warn('SSL sin verificación de certificado. En producción usa DB_SSL_CA_PATH con el certificado de Supabase.');
    }
    app.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`);
      logger.info(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      logger.info(`Proxies de confianza (trust proxy): ${saltosProxy}`);
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
