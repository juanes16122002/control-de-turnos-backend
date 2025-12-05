const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Solo con requerir db.js se crean las tablas si no existen
require('./db');

const authRoutes = require('./routes/auth.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const empresasRoutes = require('./routes/empresas.routes');
const turnosRoutes = require('./routes/turnos.routes');
const exportEmpleadoRoutes = require('./routes/exportEmpleado.routes');
const exportGlobalRoutes = require('./routes/exportGlobal.routes');

const app = express();

// Middleware global
app.use(cors());
app.use(bodyParser.json());

// Ruta básica de prueba
app.get('/', (req, res) => {
  res.send('API de Registro de Horarios');
});

// Rutas
app.use(authRoutes);
app.use(empleadosRoutes);
app.use(empresasRoutes);
app.use(turnosRoutes);
app.use(exportEmpleadoRoutes);
app.use(exportGlobalRoutes);

// Iniciar servidor (IMPORTANTE: usar process.env.PORT)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
