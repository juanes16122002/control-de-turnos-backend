const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { formatearHora } = require('../helpers/tiempo');
const { calcular } = require('./sueldo.service');
const { TARIFA_HORA, TARIFA_HORA_EXTRA } = require('../config/tarifas');

function calcularFila(row) {
  const tarifaHora = row.tarifa_hora != null ? row.tarifa_hora : TARIFA_HORA;
  const tarifaHoraExtra = row.tarifa_hora_extra != null ? row.tarifa_hora_extra : TARIFA_HORA_EXTRA;

  const v = calcular({
    horaEntrada: row.hora_entrada,
    horaSalida: row.hora_salida,
    tarifaHora,
    tarifaHoraExtra,
  });

  return {
    horasTrab: row.horas_trabajadas != null ? row.horas_trabajadas : v.horasTrab,
    horasExtra: row.horas_extra != null ? row.horas_extra : v.horasExtra,
    valor_horas_extra: row.valor_horas_extra != null ? row.valor_horas_extra : v.valor_horas_extra,
    valor_fijo: row.valor_fijo != null ? row.valor_fijo : v.valor_fijo,
    sueldo_total: row.sueldo_total != null ? row.sueldo_total : v.sueldo_total,
  };
}

exports.generarExcelEmpleado = (empleado, rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Turnos');

  sheet.addRow(['Empleado', 'Fecha', 'Empresa', 'Evento', 'Área',
    'Hora entrada', 'Hora salida', 'Horas trabajadas', 'Horas extra',
    'Valor horas extra', 'Valor fijo', 'Sueldo total']);

  let totalHorasTrab = 0, totalHorasExtra = 0;
  let totalValorHorasExtra = 0, totalValorFijo = 0, totalSueldo = 0;

  for (const row of rows) {
    const v = calcularFila(row);
    totalHorasTrab += v.horasTrab;
    totalHorasExtra += v.horasExtra;
    totalValorHorasExtra += v.valor_horas_extra || 0;
    totalValorFijo += v.valor_fijo || 0;
    totalSueldo += v.sueldo_total || 0;
    sheet.addRow([empleado.nombre, row.fecha || '', row.empresa_nombre || '',
      row.nombre_evento || '', row.area || '',
      formatearHora(row.hora_entrada), formatearHora(row.hora_salida),
      v.horasTrab || '', v.horasExtra || '',
      v.valor_horas_extra || '', v.valor_fijo || '', v.sueldo_total || '']);
  }

  sheet.addRow([]);
  sheet.addRow(['TOTALES', '', '', '', '', '', '',
    totalHorasTrab, totalHorasExtra, totalValorHorasExtra, totalValorFijo, totalSueldo]);

  return workbook;
};

exports.generarPDFEmpleado = (empleado, periodo, rows, res) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(14).text(`Turnos de ${empleado.nombre} - ${periodo}`, { align: 'center' });
  doc.moveDown();

  const startX = 30;
  let y = doc.y;
  doc.fontSize(10);
  doc.text('Fecha', startX, y); doc.text('Empresa', startX + 60, y, { width: 80 });
  doc.text('Evento', startX + 140, y, { width: 80 }); doc.text('Área', startX + 220, y, { width: 50 });
  doc.text('Ent', startX + 270, y); doc.text('Sal', startX + 295, y);
  doc.text('Trab', startX + 320, y); doc.text('Extra', startX + 360, y);
  doc.text('$Ext', startX + 395, y); doc.text('$Fijo', startX + 440, y); doc.text('Total', startX + 485, y);
  doc.moveTo(startX, y + 12).lineTo(580, y + 12).stroke();
  y += 16;

  let totalHorasTrab = 0, totalHorasExtra = 0;
  let totalValorHorasExtra = 0, totalValorFijo = 0, totalSueldo = 0;

  for (const row of rows) {
    if (y > 760) { doc.addPage(); y = 40; }
    const v = calcularFila(row);
    totalHorasTrab += v.horasTrab; totalHorasExtra += v.horasExtra;
    totalValorHorasExtra += v.valor_horas_extra || 0;
    totalValorFijo += v.valor_fijo || 0; totalSueldo += v.sueldo_total || 0;

    doc.fontSize(9);
    doc.text(row.fecha || '', startX, y);
    doc.text(row.empresa_nombre || '', startX + 60, y, { width: 80 });
    doc.text(row.nombre_evento || '', startX + 140, y, { width: 80 });
    doc.text(row.area || '', startX + 220, y, { width: 50 });
    doc.text(formatearHora(row.hora_entrada), startX + 270, y);
    doc.text(formatearHora(row.hora_salida), startX + 295, y);
    doc.text(v.horasTrab ? v.horasTrab.toFixed(2) : '', startX + 320, y);
    doc.text(v.horasExtra ? v.horasExtra.toFixed(2) : '', startX + 360, y);
    doc.text(v.valor_horas_extra ? v.valor_horas_extra.toFixed(0) : '', startX + 395, y);
    doc.text(v.valor_fijo ? v.valor_fijo.toFixed(0) : '', startX + 440, y);
    doc.text(v.sueldo_total ? v.sueldo_total.toFixed(0) : '', startX + 485, y);
    y += 14;
  }

  if (y > 720) { doc.addPage(); y = 40; }
  doc.moveDown(); y = doc.y + 10;
  doc.fontSize(11).text('RESUMEN DE TOTALES', startX, y); y += 18;
  doc.fontSize(10);
  doc.text(`Total horas trabajadas: ${totalHorasTrab.toFixed(2)}`, startX, y); y += 14;
  doc.text(`Total horas extra: ${totalHorasExtra.toFixed(2)}`, startX, y); y += 14;
  doc.text(`Total valor horas extra: ${totalValorHorasExtra.toFixed(0)}`, startX, y); y += 14;
  doc.text(`Total valor fijo: ${totalValorFijo.toFixed(0)}`, startX, y); y += 14;
  doc.text(`Sueldo total: ${totalSueldo.toFixed(0)}`, startX, y);
  doc.end();
};

exports.generarExcelGlobal = (rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Turnos');

  sheet.addRow(['FECHA', 'FIESTA O EVENTO', 'OPERACION', 'NOMBRE TECNICO',
    'DESDE', 'HASTA', 'HORAS TRABAJADAS', 'HORA EXTRA', 'COMENTARIO']);

  for (const row of rows) {
    let base = row.horas_trabajadas;
    let extra = row.horas_extra;
    if (base == null || extra == null) {
      const calc = calcularHorasBaseYExtra(row.hora_entrada, row.hora_salida);
      base = calc.base; extra = calc.extra;
    }
    sheet.addRow([row.fecha || '', row.nombre_evento || '', row.area || '',
      row.empleado_nombre || '',
      formatearHora(row.hora_entrada), formatearHora(row.hora_salida),
      base != null ? base : '', extra != null ? extra : '', '']);
  }

  return workbook;
};

exports.generarPDFGlobal = (titulo, rows, res) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(14).text(titulo, { align: 'center' });
  doc.moveDown();

  const startX = 30;
  let y = doc.y;

  doc.fontSize(10);
  doc.text('Fecha', startX, y); doc.text('Empleado', startX + 60, y, { width: 80 });
  doc.text('Empresa', startX + 140, y, { width: 70 }); doc.text('Evento', startX + 210, y, { width: 80 });
  doc.text('Área', startX + 290, y, { width: 50 }); doc.text('Ent', startX + 340, y);
  doc.text('Sal', startX + 365, y); doc.text('Trab', startX + 390, y);
  doc.text('Extra', startX + 420, y); doc.text('$Ext', startX + 455, y);
  doc.text('$Fijo', startX + 495, y); doc.text('Total', startX + 535, y);
  doc.moveTo(startX, y + 12).lineTo(580, y + 12).stroke();
  y += 16;

  for (const row of rows) {
    if (y > 760) { doc.addPage(); y = 40; }
    const v = calcularFila(row);

    doc.fontSize(9);
    doc.text(row.fecha || '', startX, y);
    doc.text(row.empleado_nombre || '', startX + 60, y, { width: 80 });
    doc.text(row.empresa_nombre || '', startX + 140, y, { width: 70 });
    doc.text(row.nombre_evento || '', startX + 210, y, { width: 80 });
    doc.text(row.area || '', startX + 290, y, { width: 50 });
    doc.text(formatearHora(row.hora_entrada), startX + 340, y);
    doc.text(formatearHora(row.hora_salida), startX + 365, y);
    doc.text(v.horasTrab ? v.horasTrab.toFixed(2) : '', startX + 390, y);
    doc.text(v.horasExtra ? v.horasExtra.toFixed(2) : '', startX + 420, y);
    doc.text(v.valor_horas_extra ? v.valor_horas_extra.toFixed(0) : '', startX + 455, y);
    doc.text(v.valor_fijo ? v.valor_fijo.toFixed(0) : '', startX + 495, y);
    doc.text(v.sueldo_total ? v.sueldo_total.toFixed(0) : '', startX + 535, y);
    y += 14;
  }

  doc.end();
};
