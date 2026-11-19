const RADIO_TIERRA_M = 6371000;
const rad = (g) => (g * Math.PI) / 180;

// Distancia en metros entre dos coordenadas (fórmula de haversine)
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Evalúa si una posición reportada por el dispositivo está dentro de la geocerca.
 * @param {{activa:boolean, lat:number, lng:number, radio_m:number, precision_max_m:number}} geocerca
 * @param {{lat:number, lng:number, precision_m:number}|null|undefined} pos
 * @returns {{permitido:boolean, motivo?:string, mensaje?:string, distancia_m?:number}}
 */
function evaluarUbicacion(geocerca, pos) {
  if (!geocerca || !geocerca.activa) return { permitido: true };

  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
    return {
      permitido: false,
      motivo: 'sin_ubicacion',
      mensaje: 'Para marcar asistencia es necesario permitir el acceso a la ubicación.',
    };
  }

  const distancia = Math.round(distanciaMetros(geocerca.lat, geocerca.lng, pos.lat, pos.lng));
  const precision = Number.isFinite(pos.precision_m) ? Math.round(pos.precision_m) : null;

  if (precision == null || precision > geocerca.precision_max_m) {
    return {
      permitido: false,
      motivo: 'imprecisa',
      distancia_m: distancia,
      mensaje: `La ubicación es poco precisa (±${precision ?? '?'} m). Activa el GPS o acércate a una ventana e intenta de nuevo.`,
    };
  }

  if (distancia > geocerca.radio_m) {
    return {
      permitido: false,
      motivo: 'fuera_de_rango',
      distancia_m: distancia,
      mensaje: `Estás a ${formatearDistancia(distancia)} del local. Debes estar en el lugar de trabajo para marcar.`,
    };
  }

  return { permitido: true, distancia_m: distancia };
}

function formatearDistancia(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`;
}

module.exports = { distanciaMetros, evaluarUbicacion, formatearDistancia };
