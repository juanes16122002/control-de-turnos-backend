const test = require('node:test');
const assert = require('node:assert');
const { calcularHorasBaseYExtra, formatearHora } = require('../helpers/tiempo');

test('calcula 8 horas base y 0 extra', () => {
  const r = calcularHorasBaseYExtra('2026-01-01T08:00:00Z', '2026-01-01T16:00:00Z');
  assert.strictEqual(r.base, 8);
  assert.strictEqual(r.extra, 0);
});

test('más de 8 horas reparte base y extra', () => {
  const r = calcularHorasBaseYExtra('2026-01-01T08:00:00Z', '2026-01-01T20:00:00Z');
  assert.strictEqual(r.base, 8);
  assert.strictEqual(r.extra, 4);
});

test('cruce de medianoche', () => {
  const r = calcularHorasBaseYExtra('2026-01-01T23:00:00Z', '2026-01-02T07:00:00Z');
  assert.strictEqual(r.base, 8);
  assert.strictEqual(r.extra, 0);
});

test('entrada o salida nula devuelve 0', () => {
  assert.deepStrictEqual(calcularHorasBaseYExtra(null, '2026-01-01T16:00:00Z'), { base: 0, extra: 0 });
  assert.deepStrictEqual(calcularHorasBaseYExtra('2026-01-01T08:00:00Z', null), { base: 0, extra: 0 });
});

test('formatearHora convierte UTC a hora de Chile', () => {
  assert.strictEqual(formatearHora('2026-01-01T08:00:00Z'), '05:00');
});

test('formatearHora con valor nulo devuelve vacío', () => {
  assert.strictEqual(formatearHora(null), '');
});
