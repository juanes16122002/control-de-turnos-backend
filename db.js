const { Pool } = require('pg');
const { construirConfigPool } = require('./config/database');

const { _info: infoConexion, ...configPool } = construirConfigPool();
const pool = new Pool(configPool);

// Sin este handler, un cliente ocioso que el servidor/pooler cierra (habitual en
// Supabase por mantenimiento o timeouts) emite 'error' y tumba el proceso.
pool.on('error', (err) => {
  console.error('[db] Error en cliente ocioso del pool:', err.message);
});

// Tablas propias de la app. En Supabase el esquema `public` se publica en la
// Data API (PostgREST): sin RLS, cualquiera con la anon key podría leerlas
// (incluido empleados.pin_hash). Activar RLS sin políticas bloquea ese acceso,
// mientras que el backend —que se conecta como el dueño de las tablas— no se ve afectado.
const TABLAS = ['empleados', 'empresas', 'turnos', 'refresh_tokens', 'asistencias', 'configuracion', 'eventos', 'evento_empleados'];

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empleados (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      tarifa_hora DOUBLE PRECISION DEFAULT 4750,
      tarifa_hora_extra DOUBLE PRECISION DEFAULT 4750
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS turnos (
      id SERIAL PRIMARY KEY,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      hora_entrada TIMESTAMPTZ NOT NULL,
      hora_salida TIMESTAMPTZ,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
      nombre_evento TEXT,
      area TEXT,
      horas_trabajadas DOUBLE PRECISION,
      horas_extra DOUBLE PRECISION,
      valor_horas_extra DOUBLE PRECISION,
      valor_fijo DOUBLE PRECISION,
      sueldo_total DOUBLE PRECISION
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      usuario TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // --- Sesiones: rotación de refresh tokens con familias, hash y expiraciones ---
  // Cada login crea una "familia" (sesión). Los tokens se guardan como hash SHA-256,
  // son de un solo uso y se encadenan con reemplazado_por para detectar reusos.
  await pool.query(`
    ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS token_hash TEXT,
      ADD COLUMN IF NOT EXISTS familia TEXT,
      ADD COLUMN IF NOT EXISTS expira_absoluta TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS usado_en TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reemplazado_por TEXT,
      ADD COLUMN IF NOT EXISTS revocado_en TIMESTAMPTZ
  `);
  // Tokens del esquema anterior (texto plano, sin familia): se invalidan
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash IS NULL');
  await pool.query('ALTER TABLE refresh_tokens ALTER COLUMN token DROP NOT NULL');
  // TIMESTAMP sin zona se interpretaba según la zona de la sesión (Chile vs UTC en Supabase)
  await pool.query(`
    DO $$ BEGIN
      IF (SELECT data_type FROM information_schema.columns
          WHERE table_name = 'refresh_tokens' AND column_name = 'expires_at') = 'timestamp without time zone' THEN
        ALTER TABLE refresh_tokens
          ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
          ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
      END IF;
    END $$
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_tokens_hash ON refresh_tokens (token_hash)');
  await pool.query('CREATE INDEX IF NOT EXISTS ix_refresh_tokens_familia ON refresh_tokens (familia)');

  // --- Módulo de asistencia ---
  // PIN del kiosco (hash bcrypt) y bloqueo por intentos fallidos
  await pool.query(`
    ALTER TABLE empleados
      ADD COLUMN IF NOT EXISTS pin_hash TEXT,
      ADD COLUMN IF NOT EXISTS pin_intentos INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pin_bloqueado_hasta TIMESTAMPTZ
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS asistencias (
      id SERIAL PRIMARY KEY,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
      entrada TIMESTAMPTZ NOT NULL,
      salida TIMESTAMPTZ,
      origen_entrada TEXT NOT NULL DEFAULT 'kiosco' CHECK (origen_entrada IN ('kiosco', 'admin')),
      origen_salida TEXT CHECK (origen_salida IN ('kiosco', 'admin')),
      observacion TEXT,
      turno_id INTEGER REFERENCES turnos(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT asistencias_salida_posterior CHECK (salida IS NULL OR salida > entrada)
    )
  `);

  // Un empleado solo puede tener una asistencia abierta (sin salida) a la vez.
  // Protege contra dobles marcas concurrentes a nivel de BD.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_asistencias_abierta
      ON asistencias (empleado_id) WHERE salida IS NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ix_asistencias_entrada ON asistencias (entrada)
  `);

  // Ubicación reportada al marcar: { lat, lng, precision_m, distancia_m }
  await pool.query(`
    ALTER TABLE asistencias
      ADD COLUMN IF NOT EXISTS ubicacion_entrada JSONB,
      ADD COLUMN IF NOT EXISTS ubicacion_salida JSONB
  `);

  // Configuración editable desde el panel (p. ej. la geocerca del kiosco)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // --- Eventos ---
  // Un evento siempre pertenece a una empresa (productora). La empresa no se puede borrar
  // mientras tenga eventos (RESTRICT): se perdería a quién se le trabajó.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      descripcion TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT eventos_fechas_validas CHECK (fecha_fin >= fecha_inicio)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ix_eventos_fechas ON eventos (fecha_inicio, fecha_fin)');

  // Empleados asignados a cada evento
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evento_empleados (
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (evento_id, empleado_id)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ix_evento_empleados_empleado ON evento_empleados (empleado_id)');

  // Evento al que pertenece cada asistencia (se asigna automáticamente al marcar)
  await pool.query(`
    ALTER TABLE asistencias
      ADD COLUMN IF NOT EXISTS evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ix_asistencias_evento ON asistencias (evento_id)');

  // Idempotente: no falla si RLS ya estaba activo
  for (const tabla of TABLAS) {
    await pool.query(`ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY`);
  }
}

module.exports = { pool, initDb, infoConexion, TABLAS };
