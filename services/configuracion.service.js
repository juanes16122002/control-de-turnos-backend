const { pool } = require('../db');

const CLAVE_GEOCERCA = 'geocerca_asistencia';

// Valores por defecto: desactivada hasta que el admin configure la ubicación del local.
// radio_m 200: margen razonable para el error típico del GPS/WiFi en interiores.
const GEOCERCA_POR_DEFECTO = {
  activa: false,
  lat: null,
  lng: null,
  radio_m: 200,
  precision_max_m: 150,
  nombre: '',
};

exports.obtenerGeocerca = async () => {
  const { rows } = await pool.query('SELECT valor, updated_at FROM configuracion WHERE clave = $1', [CLAVE_GEOCERCA]);
  if (!rows[0]) return { ...GEOCERCA_POR_DEFECTO, updated_at: null };
  return { ...GEOCERCA_POR_DEFECTO, ...rows[0].valor, updated_at: rows[0].updated_at };
};

exports.guardarGeocerca = async ({ activa, lat, lng, radio_m, precision_max_m, nombre }) => {
  const valor = {
    activa: !!activa,
    lat: lat == null || lat === '' ? null : Number(lat),
    lng: lng == null || lng === '' ? null : Number(lng),
    radio_m: Number(radio_m),
    precision_max_m: Number(precision_max_m),
    nombre: (nombre || '').trim(),
  };
  await pool.query(`
    INSERT INTO configuracion (clave, valor, updated_at) VALUES ($1, $2, NOW())
    ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
  `, [CLAVE_GEOCERCA, valor]);
  return exports.obtenerGeocerca();
};
