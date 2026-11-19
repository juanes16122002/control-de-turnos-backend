const test = require('node:test');
const assert = require('node:assert');
const { crearSaludHandler } = require('../controllers/salud.controller');

const logMudo = { error: () => {} };

function resFalsa() {
  return {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('base disponible: 200 ok y ejecuta SELECT 1', async () => {
  let consulta;
  const pool = { query: async (sql) => { consulta = sql; return { rows: [{ '?column?': 1 }] }; } };
  const res = resFalsa();
  await crearSaludHandler(pool, { log: logMudo })({}, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.estado, 'ok');
  assert.strictEqual(res.body.db, 'ok');
  assert.strictEqual(typeof res.body.ms, 'number');
  assert.strictEqual(consulta, 'SELECT 1');
  assert.strictEqual(res.headers['Cache-Control'], 'no-store');
});

test('base con error: 503 sin exponer el mensaje original', async () => {
  const pool = { query: async () => { throw new Error('password authentication failed for user "postgres.secreto"'); } };
  const res = resFalsa();
  await crearSaludHandler(pool, { log: logMudo })({}, res);
  assert.strictEqual(res.statusCode, 503);
  assert.deepStrictEqual(res.body, { estado: 'error', db: 'sin conexión' });
  assert.doesNotMatch(JSON.stringify(res.body), /password|postgres|secreto/);
});

test('base colgada: 503 "sin respuesta" al vencer el límite de tiempo', async () => {
  const pool = { query: () => new Promise(() => {}) }; // nunca responde
  const res = resFalsa();
  const t0 = Date.now();
  await crearSaludHandler(pool, { log: logMudo, timeoutMs: 50 })({}, res);
  assert.ok(Date.now() - t0 < 1000, 'no debe quedarse esperando');
  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.db, 'sin respuesta');
});

test('registra el error real en el log (para diagnóstico) aunque no lo devuelva', async () => {
  const mensajes = [];
  const pool = { query: async () => { throw new Error('ECONNREFUSED'); } };
  await crearSaludHandler(pool, { log: { error: (m) => mensajes.push(m) } })({}, resFalsa());
  assert.match(mensajes[0], /ECONNREFUSED/);
});
