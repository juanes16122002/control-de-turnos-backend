const test = require('node:test');
const assert = require('node:assert');
const { resolverSaltosProxy } = require('../config/proxy');

test('por defecto (local, sin proxy): 0', () => {
  assert.strictEqual(resolverSaltosProxy({}), 0);
});

test('en Railway se detecta automáticamente: 1', () => {
  assert.strictEqual(resolverSaltosProxy({ RAILWAY_PROJECT_ID: 'abc' }), 1);
  assert.strictEqual(resolverSaltosProxy({ RAILWAY_ENVIRONMENT_NAME: 'production' }), 1);
});

test('TRUST_PROXY explícito tiene prioridad', () => {
  assert.strictEqual(resolverSaltosProxy({ TRUST_PROXY: '2' }), 2);
  assert.strictEqual(resolverSaltosProxy({ TRUST_PROXY: '0', RAILWAY_PROJECT_ID: 'abc' }), 0);
});

test('TRUST_PROXY inválido falla al arrancar', () => {
  for (const v of ['true', '-1', '1.5', '99']) {
    assert.throws(() => resolverSaltosProxy({ TRUST_PROXY: v }), /TRUST_PROXY inválido/);
  }
});

const { ipCliente, esRender } = require('../config/proxy');

test('en Render se detecta automáticamente: 1', () => {
  assert.strictEqual(resolverSaltosProxy({ RENDER: 'true' }), 1);
  assert.strictEqual(esRender({ RENDER: 'true' }), true);
  assert.strictEqual(esRender({}), false);
});

test('en Render la IP del cliente sale de CF-Connecting-IP (no falsificable)', () => {
  const req = { ip: '10.0.0.5', headers: { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4, 203.0.113.9' } };
  assert.strictEqual(ipCliente(req, { RENDER: 'true' }), '203.0.113.9');
});

test('fuera de Render se ignora CF-Connecting-IP (lo podría enviar el cliente) y se usa req.ip', () => {
  const req = { ip: '198.51.100.20', headers: { 'cf-connecting-ip': '1.1.1.1' } };
  assert.strictEqual(ipCliente(req, {}), '198.51.100.20');
});

test('en Render sin cabecera de Cloudflare se usa req.ip', () => {
  assert.strictEqual(ipCliente({ ip: '10.0.0.5', headers: {} }, { RENDER: 'true' }), '10.0.0.5');
});
