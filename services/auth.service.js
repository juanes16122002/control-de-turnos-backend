const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const {
  ACCESS_TTL, JWT_ALGORITMO, REFRESH_INACTIVIDAD_HORAS, SESION_MAX_DIAS, GRACIA_REUSO_SEGUNDOS,
} = require('../config/auth');

const adminPassHash = bcrypt.hashSync(process.env.ADMIN_PASS, 10);

exports.verificarCredenciales = async (usuario, contrasena) => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  // Se compara siempre (aunque el usuario no coincida) para no revelar por tiempo de respuesta
  const passOk = await bcrypt.compare(contrasena, adminPassHash);
  return usuario === adminUser && passOk;
};

exports.generarToken = (usuario) => jwt.sign({ usuario }, process.env.JWT_SECRET, {
  expiresIn: ACCESS_TTL,
  algorithm: JWT_ALGORITMO,
});

// Solo se guarda el hash: si la tabla se filtra, los tokens no sirven
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const nuevoToken = () => crypto.randomBytes(40).toString('hex');

const sesionInvalida = (mensaje) => new AppError(401, mensaje);

async function insertarToken(db, { usuario, familia, expiraAbsoluta }) {
  const token = nuevoToken();
  const hash = hashToken(token);
  // Vence por inactividad, pero nunca después del máximo absoluto de la sesión
  await db.query(`
    INSERT INTO refresh_tokens (token_hash, usuario, familia, expires_at, expira_absoluta)
    VALUES ($1, $2, $3, LEAST(NOW() + make_interval(hours => $4), $5), $5)
  `, [hash, usuario, familia, REFRESH_INACTIVIDAD_HORAS, expiraAbsoluta]);
  return { token, hash };
}

// Login: crea una sesión (familia) nueva
exports.crearSesion = async (usuario) => {
  // Limpieza oportunista de sesiones vencidas hace más de un día
  await pool.query(`DELETE FROM refresh_tokens WHERE expira_absoluta < NOW() - interval '1 day'`);
  const familia = crypto.randomUUID();
  const { rows: [{ limite }] } = await pool.query(
    'SELECT NOW() + make_interval(days => $1) AS limite', [SESION_MAX_DIAS]
  );
  const { token } = await insertarToken(pool, { usuario, familia, expiraAbsoluta: limite });
  return token;
};

/**
 * Rota un refresh token: lo marca como usado y emite uno nuevo de la misma sesión.
 * - Token ya usado dentro del margen de gracia → renovación concurrente (otra pestaña): se permite.
 * - Token ya usado fuera del margen → posible robo: se revoca TODA la sesión.
 * - Vencido por inactividad o por duración máxima → se rechaza.
 */
exports.rotarRefreshToken = async (token) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, usuario, familia, expires_at, expira_absoluta, usado_en, revocado_en,
             (usado_en IS NOT NULL AND usado_en > NOW() - make_interval(secs => $2)) AS en_gracia,
             expires_at <= NOW() AS vencido_inactividad,
             expira_absoluta <= NOW() AS vencido_absoluto
      FROM refresh_tokens WHERE token_hash = $1
      FOR UPDATE
    `, [hashToken(token), GRACIA_REUSO_SEGUNDOS]);
    const t = rows[0];

    if (!t) throw sesionInvalida('Sesión inválida. Inicia sesión nuevamente.');
    if (t.revocado_en) throw sesionInvalida('La sesión fue cerrada. Inicia sesión nuevamente.');

    if (t.usado_en && !t.en_gracia) {
      // Reuso de un token ya rotado: alguien tiene una copia. Se corta la sesión completa
      // (también para quien tenga el token más reciente).
      await client.query('UPDATE refresh_tokens SET revocado_en = NOW() WHERE familia = $1 AND revocado_en IS NULL', [t.familia]);
      await client.query('COMMIT');
      logger.warn(`Reuso de refresh token detectado (usuario ${t.usuario}, sesión ${t.familia}). Sesión revocada.`);
      throw sesionInvalida('Por seguridad se cerró la sesión. Inicia sesión nuevamente.');
    }
    if (t.vencido_absoluto) throw sesionInvalida('La sesión alcanzó su duración máxima. Inicia sesión nuevamente.');
    if (t.vencido_inactividad) throw sesionInvalida('La sesión expiró por inactividad. Inicia sesión nuevamente.');

    const { token: siguiente, hash } = await insertarToken(client, {
      usuario: t.usuario, familia: t.familia, expiraAbsoluta: t.expira_absoluta,
    });
    // En gracia (renovación concurrente) se conserva la primera marca de uso
    await client.query(`
      UPDATE refresh_tokens SET usado_en = COALESCE(usado_en, NOW()), reemplazado_por = $2 WHERE id = $1
    `, [t.id, hash]);
    await client.query('COMMIT');
    return { usuario: t.usuario, refreshToken: siguiente };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

// Logout: revoca la sesión completa a la que pertenece el token
exports.revocarSesion = async (token) => {
  await pool.query(`
    UPDATE refresh_tokens SET revocado_en = NOW()
    WHERE familia = (SELECT familia FROM refresh_tokens WHERE token_hash = $1) AND revocado_en IS NULL
  `, [hashToken(token)]);
};

exports.revocarSesionesDeUsuario = async (usuario) => {
  await pool.query('UPDATE refresh_tokens SET revocado_en = NOW() WHERE usuario = $1 AND revocado_en IS NULL', [usuario]);
};

exports._hashToken = hashToken; // para pruebas
