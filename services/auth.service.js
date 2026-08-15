const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');

const adminPassHash = bcrypt.hashSync(process.env.ADMIN_PASS, 10);

exports.verificarCredenciales = (usuario, contrasena) => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  if (usuario !== adminUser) return false;
  return bcrypt.compareSync(contrasena, adminPassHash);
};

exports.generarToken = (usuario) => {
  return jwt.sign({ usuario }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

exports.generarRefreshToken = async (usuario) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    'INSERT INTO refresh_tokens (token, usuario, expires_at) VALUES ($1, $2, $3)',
    [token, usuario, expiresAt]
  );
  return token;
};

exports.verificarRefreshToken = async (token) => {
  const { rows } = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return rows[0] || null;
};

exports.eliminarRefreshToken = async (token) => {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
};

exports.eliminarRefreshTokensPorUsuario = async (usuario) => {
  await pool.query('DELETE FROM refresh_tokens WHERE usuario = $1', [usuario]);
};
