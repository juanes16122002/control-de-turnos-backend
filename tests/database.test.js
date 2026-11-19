const test = require('node:test');
const assert = require('node:assert');
const { construirConfigPool, esSupabase } = require('../config/database');

const sinCA = { leerCertificado: () => null };
const SESSION_POOLER = 'postgresql://postgres.abcdefgh:secreta@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

test('local sin SSL por defecto', () => {
  const c = construirConfigPool({ DATABASE_URL: 'postgresql://u:p@localhost:5432/turnos' }, sinCA);
  assert.strictEqual(c.ssl, false);
  assert.strictEqual(c._info.sslModo, 'disable');
  assert.strictEqual(c._info.supabase, false);
});

test('sin DATABASE_URL usa la base local por defecto', () => {
  const c = construirConfigPool({}, sinCA);
  assert.match(c.connectionString, /localhost:5432\/turnos/);
});

test('Supabase activa SSL automáticamente', () => {
  const c = construirConfigPool({ DATABASE_URL: SESSION_POOLER }, sinCA);
  assert.deepStrictEqual(c.ssl, { rejectUnauthorized: false });
  assert.strictEqual(c._info.supabase, true);
  assert.strictEqual(c._info.poolerTransaccional, false);
});

test('conexión directa db.<ref>.supabase.co también se detecta', () => {
  assert.strictEqual(esSupabase('db.abcdefgh.supabase.co'), true);
  assert.strictEqual(esSupabase('supabase.co.evil.com'), false);
  assert.strictEqual(esSupabase('localhost'), false);
});

test('quita sslmode de la URL para que no pise la opción ssl', () => {
  const c = construirConfigPool({ DATABASE_URL: `${SESSION_POOLER}?sslmode=require&application_name=x` }, sinCA);
  assert.doesNotMatch(c.connectionString, /sslmode/);
  assert.match(c.connectionString, /application_name=x/);
  assert.deepStrictEqual(c.ssl, { rejectUnauthorized: false });
});

test('con CA usa verificación completa', () => {
  const c = construirConfigPool({ DATABASE_URL: SESSION_POOLER }, { leerCertificado: () => 'PEM' });
  assert.deepStrictEqual(c.ssl, { ca: 'PEM', rejectUnauthorized: true });
  assert.strictEqual(c._info.sslModo, 'verify');
});

test('DB_SSL=verify sin CA falla con mensaje claro', () => {
  assert.throws(() => construirConfigPool({ DATABASE_URL: SESSION_POOLER, DB_SSL: 'verify' }, sinCA), /DB_SSL_CA/);
});

test('DB_SSL explícito tiene prioridad', () => {
  const c = construirConfigPool({ DATABASE_URL: SESSION_POOLER, DB_SSL: 'disable' }, sinCA);
  assert.strictEqual(c.ssl, false);
  const l = construirConfigPool({ DATABASE_URL: 'postgresql://u:p@localhost/t', DB_SSL: 'require' }, sinCA);
  assert.deepStrictEqual(l.ssl, { rejectUnauthorized: false });
});

test('DB_SSL inválido falla', () => {
  assert.throws(() => construirConfigPool({ DATABASE_URL: SESSION_POOLER, DB_SSL: 'si' }, sinCA), /DB_SSL inválido/);
});

test('detecta el pooler transaccional (puerto 6543)', () => {
  const c = construirConfigPool({ DATABASE_URL: SESSION_POOLER.replace(':5432', ':6543') }, sinCA);
  assert.strictEqual(c._info.poolerTransaccional, true);
});

test('DB_POOL_MAX configura el tamaño del pool', () => {
  assert.strictEqual(construirConfigPool({ DATABASE_URL: SESSION_POOLER }, sinCA).max, 10);
  assert.strictEqual(construirConfigPool({ DATABASE_URL: SESSION_POOLER, DB_POOL_MAX: '4' }, sinCA).max, 4);
});

test('DB_SSL_CA admite saltos de línea escapados (\\n) desde variables de entorno', () => {
  const { construirConfigPool: build } = require('../config/database');
  const c = build({ DATABASE_URL: SESSION_POOLER, DB_SSL_CA: '-----BEGIN-----\\nABC\\n-----END-----' });
  assert.strictEqual(c.ssl.ca, '-----BEGIN-----\nABC\n-----END-----');
});
