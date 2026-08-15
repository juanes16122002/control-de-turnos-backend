const test = require('node:test');
const assert = require('node:assert');
const { calcular } = require('../services/sueldo.service');

test('turno de 8 horas: 8 base, 0 extra', () => {
  const v = calcular({ horaEntrada: '2026-01-01T08:00:00Z', horaSalida: '2026-01-01T16:00:00Z' });
  assert.strictEqual(v.horasTrab, 8);
  assert.strictEqual(v.horasExtra, 0);
  assert.strictEqual(v.valor_fijo, 38000);
  assert.strictEqual(v.valor_horas_extra, 0);
  assert.strictEqual(v.sueldo_total, 38000);
});

test('turno de 10 horas: 8 base + 2 extra', () => {
  const v = calcular({ horaEntrada: '2026-01-01T08:00:00Z', horaSalida: '2026-01-01T18:00:00Z' });
  assert.strictEqual(v.horasTrab, 8);
  assert.strictEqual(v.horasExtra, 2);
  assert.strictEqual(v.valor_horas_extra, 9500);
  assert.strictEqual(v.sueldo_total, 47500);
});

test('turno que cruza medianoche (22:00 a 06:00)', () => {
  const v = calcular({ horaEntrada: '2026-01-01T22:00:00Z', horaSalida: '2026-01-02T06:00:00Z' });
  assert.strictEqual(v.horasTrab, 8);
  assert.strictEqual(v.horasExtra, 0);
});

test('salida <= entrada sin fecha distinta suma 24h', () => {
  const v = calcular({ horaEntrada: '2026-01-01T22:00:00Z', horaSalida: '2026-01-01T06:00:00Z' });
  assert.strictEqual(v.horasTrab, 8);
  assert.strictEqual(v.horasExtra, 0);
});

test('sin hora de salida devuelve 0', () => {
  const v = calcular({ horaEntrada: '2026-01-01T08:00:00Z', horaSalida: null });
  assert.strictEqual(v.horasTrab, 0);
  assert.strictEqual(v.horasExtra, 0);
  assert.strictEqual(v.sueldo_total, 0);
});

test('tarifa personalizada se aplica', () => {
  const v = calcular({
    horaEntrada: '2026-01-01T08:00:00Z',
    horaSalida: '2026-01-01T16:00:00Z',
    tarifaHora: 5000,
    tarifaHoraExtra: 6000,
  });
  assert.strictEqual(v.valor_fijo, 40000);
});

test('turno fraccionado de 7.5 horas', () => {
  const v = calcular({ horaEntrada: '2026-01-01T08:30:00Z', horaSalida: '2026-01-01T16:00:00Z' });
  assert.strictEqual(v.horasTrab, 7.5);
  assert.strictEqual(v.horasExtra, 0);
});

test('9.5 horas: 8 base + 1.5 extra', () => {
  const v = calcular({ horaEntrada: '2026-01-01T08:30:00Z', horaSalida: '2026-01-01T18:00:00Z' });
  assert.strictEqual(v.horasTrab, 8);
  assert.strictEqual(v.horasExtra, 1.5);
});
