const test = require('node:test');
const assert = require('node:assert');
const { distanciaMetros, evaluarUbicacion, formatearDistancia } = require('../helpers/geo');

// Plaza de Armas de Santiago y Palacio de La Moneda: ~ 750 m
const PLAZA = { lat: -33.4378, lng: -70.6505 };
const MONEDA = { lat: -33.4429, lng: -70.6539 };

const geocerca = { activa: true, lat: PLAZA.lat, lng: PLAZA.lng, radio_m: 200, precision_max_m: 150 };

test('distanciaMetros: mismo punto = 0', () => {
  assert.strictEqual(distanciaMetros(PLAZA.lat, PLAZA.lng, PLAZA.lat, PLAZA.lng), 0);
});

test('distanciaMetros: Plaza de Armas -> La Moneda ~650 m', () => {
  const d = distanciaMetros(PLAZA.lat, PLAZA.lng, MONEDA.lat, MONEDA.lng);
  assert.ok(d > 600 && d < 700, `distancia inesperada: ${d}`);
});

test('distanciaMetros: 0,001° de latitud ≈ 111 m', () => {
  const d = distanciaMetros(0, 0, 0.001, 0);
  assert.ok(Math.abs(d - 111.2) < 0.5, `distancia inesperada: ${d}`);
});

test('geocerca inactiva siempre permite (incluso sin ubicación)', () => {
  assert.deepStrictEqual(evaluarUbicacion({ ...geocerca, activa: false }, null), { permitido: true });
  assert.deepStrictEqual(evaluarUbicacion(null, null), { permitido: true });
});

test('dentro del radio con buena precisión: permitido', () => {
  const r = evaluarUbicacion(geocerca, { lat: PLAZA.lat + 0.0005, lng: PLAZA.lng, precision_m: 20 });
  assert.strictEqual(r.permitido, true);
  assert.ok(r.distancia_m >= 50 && r.distancia_m <= 60, `distancia: ${r.distancia_m}`);
});

test('fuera del radio: rechazado con distancia en el mensaje', () => {
  const r = evaluarUbicacion(geocerca, { ...MONEDA, precision_m: 15 });
  assert.strictEqual(r.permitido, false);
  assert.strictEqual(r.motivo, 'fuera_de_rango');
  assert.match(r.mensaje, /Estás a \d+ m del local/);
});

test('precisión peor que el máximo: rechazado aunque caiga dentro', () => {
  const r = evaluarUbicacion(geocerca, { ...PLAZA, precision_m: 1500 });
  assert.strictEqual(r.permitido, false);
  assert.strictEqual(r.motivo, 'imprecisa');
});

test('sin precisión reportada: rechazado', () => {
  assert.strictEqual(evaluarUbicacion(geocerca, { ...PLAZA }).motivo, 'imprecisa');
});

test('sin ubicación o coordenadas inválidas: rechazado', () => {
  assert.strictEqual(evaluarUbicacion(geocerca, null).motivo, 'sin_ubicacion');
  assert.strictEqual(evaluarUbicacion(geocerca, { lat: NaN, lng: 1, precision_m: 5 }).motivo, 'sin_ubicacion');
});

test('justo dentro del borde del radio: permitido', () => {
  // 0,0089° al norte ≈ 990 m, con radio de 1000 m
  const r = evaluarUbicacion({ ...geocerca, radio_m: 1000 }, { lat: PLAZA.lat + 0.0089, lng: PLAZA.lng, precision_m: 10 });
  assert.strictEqual(r.permitido, true);
});

test('formatearDistancia', () => {
  assert.strictEqual(formatearDistancia(850), '850 m');
  assert.strictEqual(formatearDistancia(2340), '2,3 km');
});
