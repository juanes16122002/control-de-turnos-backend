const test = require('node:test');
const assert = require('node:assert');
const { pinValido, calcularDuracionHoras, fechaLocal, validarRango } = require('../helpers/asistencia');

test('pinValido acepta 4 a 6 dígitos', () => {
  assert.strictEqual(pinValido('1234'), true);
  assert.strictEqual(pinValido('123456'), true);
});

test('pinValido rechaza formatos inválidos', () => {
  for (const pin of ['123', '1234567', '12a4', '', ' 1234', null, undefined, 1234]) {
    assert.strictEqual(pinValido(pin), false, `debería rechazar ${JSON.stringify(pin)}`);
  }
});

test('calcularDuracionHoras con entrada y salida', () => {
  assert.strictEqual(calcularDuracionHoras('2026-01-01T08:00:00Z', '2026-01-01T17:30:00Z'), 9.5);
});

test('calcularDuracionHoras de turno nocturno (cruza medianoche)', () => {
  assert.strictEqual(calcularDuracionHoras('2026-01-01T22:00:00Z', '2026-01-02T06:15:00Z'), 8.25);
});

test('calcularDuracionHoras sin salida usa "ahora"', () => {
  const ahora = new Date('2026-01-01T10:00:00Z');
  assert.strictEqual(calcularDuracionHoras('2026-01-01T08:00:00Z', null, ahora), 2);
});

test('calcularDuracionHoras nunca devuelve negativo', () => {
  assert.strictEqual(calcularDuracionHoras('2026-01-01T10:00:00Z', '2026-01-01T08:00:00Z'), 0);
  assert.strictEqual(calcularDuracionHoras(null, null), 0);
});

test('fechaLocal usa la zona de Chile (no UTC)', () => {
  // 02:00 UTC del 2 de enero = 23:00 del 1 de enero en Chile (UTC-3 en verano)
  assert.strictEqual(fechaLocal('2026-01-02T02:00:00Z', 'America/Santiago'), '2026-01-01');
  assert.strictEqual(fechaLocal(null), '');
});

test('validarRango acepta rango correcto y salida vacía', () => {
  const ahora = new Date('2026-01-02T00:00:00Z');
  assert.strictEqual(validarRango('2026-01-01T08:00:00Z', '2026-01-01T16:00:00Z', { ahora }), null);
  assert.strictEqual(validarRango('2026-01-01T08:00:00Z', null, { ahora }), null);
});

test('validarRango rechaza salida anterior o igual a la entrada', () => {
  const ahora = new Date('2026-01-02T00:00:00Z');
  assert.match(validarRango('2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z', { ahora }), /posterior/);
  assert.match(validarRango('2026-01-01T08:00:00Z', '2026-01-01T07:00:00Z', { ahora }), /posterior/);
});

test('validarRango rechaza fechas futuras salvo la tolerancia', () => {
  const ahora = new Date('2026-01-01T12:00:00Z');
  assert.match(validarRango('2026-01-01T13:00:00Z', null, { ahora }), /futuro/);
  assert.match(validarRango('2026-01-01T08:00:00Z', '2026-01-01T13:00:00Z', { ahora }), /futuro/);
  assert.strictEqual(
    validarRango('2026-01-01T12:03:00Z', null, { ahora, toleranciaMs: 5 * 60 * 1000 }),
    null
  );
});

test('validarRango rechaza fechas inválidas', () => {
  assert.match(validarRango('no-es-fecha', null), /entrada no es válida/);
  assert.match(validarRango('2026-01-01T08:00:00Z', 'xx', { ahora: new Date('2026-02-01') }), /salida no es válida/);
});
