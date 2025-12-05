// routes/exportGlobal.routes.js
const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { formatearHora, calcularHorasBaseYExtra } = require('../helpers/tiempo');

const router = express.Router();

// Tarifas (deben coincidir con las usadas en turnos.routes.js)
const TARIFA_HORA = 3750;          // valor por hora normal
const TARIFA_HORA_EXTRA = 3750;    // valor por hora extra

// =======================================================
//                  Excel global
// =======================================================
// Excel global
router.get('/turnos/excel', (req, res) => {
  let { desde, hasta, empleado_id, empresa_id } = req.query;

  let sql = `
    SELECT
      t.id,
      t.fecha,
      t.hora_entrada,
      t.hora_salida,
      t.nombre_evento,
      t.area,
      t.horas_trabajadas,
      t.horas_extra,
      e.nombre AS empleado_nombre,
      emp.nombre AS empresa_nombre
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    WHERE 1 = 1
  `;
  const params = [];

  if (desde && hasta) {
    sql += ' AND t.fecha >= ? AND t.fecha <= ?';
    params.push(desde, hasta);
  }

  if (empleado_id) {
    sql += ' AND t.empleado_id = ?';
    params.push(empleado_id);
  }

  if (empresa_id) {
    sql += ' AND t.empresa_id = ?';
    params.push(empresa_id);
  }

  sql += ' ORDER BY t.fecha, t.hora_entrada';

  db.all(sql, params, async (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener turnos globales' });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Turnos');

      // Encabezados según el formato que te piden
      sheet.addRow([
        'FECHA',
        'FIESTA O EVENTO',
        'OPERACION',
        'NOMBRE TECNICO',
        'DESDE',
        'HASTA',
        'HORAS TRABAJADAS',
        'HORA EXTRA',
        'COMENTARIO',
      ]);

      rows.forEach((row) => {
        let base = row.horas_trabajadas;
        let extra = row.horas_extra;

        if (base == null || extra == null) {
          const calc = calcularHorasBaseYExtra(
            row.hora_entrada,
            row.hora_salida
          );
          base = calc.base;
          extra = calc.extra;
        }

        sheet.addRow([
          row.fecha || '',
          row.nombre_evento || '',
          row.area || '',
          row.empleado_nombre || '',
          formatearHora(row.hora_entrada),
          formatearHora(row.hora_salida),
          base != null ? base : '',
          extra != null ? extra : '',
          '', // comentario vacío por ahora
        ]);
      });

      const labelPeriodo =
        desde && hasta ? `${desde}_a_${hasta}` : 'periodo';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=turnos_formato_cliente_${labelPeriodo}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al generar Excel global' });
    }
  });
});


// =======================================================
//                  PDF global
// =======================================================
router.get('/turnos/pdf', (req, res) => {
  let { desde, hasta, empleado_id, empresa_id } = req.query;

  let sql = `
    SELECT
      t.id,
      t.fecha,
      t.hora_entrada,
      t.hora_salida,
      t.nombre_evento,
      t.area,
      t.horas_trabajadas,
      t.horas_extra,
      t.valor_horas_extra,
      t.valor_fijo,
      t.sueldo_total,
      e.nombre AS empleado_nombre,
      emp.nombre AS empresa_nombre
    FROM turnos t
    JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN empresas emp ON t.empresa_id = emp.id
    WHERE 1 = 1
  `;
  const params = [];

  if (desde && hasta) {
    sql += ' AND t.fecha >= ? AND t.fecha <= ?';
    params.push(desde, hasta);
  }

  if (empleado_id) {
    sql += ' AND t.empleado_id = ?';
    params.push(empleado_id);
  }

  if (empresa_id) {
    sql += ' AND t.empresa_id = ?';
    params.push(empresa_id);
  }

  sql += ' ORDER BY t.fecha, t.hora_entrada';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener turnos globales' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    const labelPeriodo =
      desde && hasta ? `${desde}_a_${hasta}` : 'periodo';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=turnos_global_${labelPeriodo}.pdf`
    );

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(14).text(
      `Turnos ${
        desde && hasta ? `de ${desde} a ${hasta}` : ' sin rango definido'
      }`,
      { align: 'center' }
    );
    doc.moveDown();

    const startX = 30;
    let y = doc.y;

    doc.fontSize(10);
    // Encabezados
    doc.text('Fecha', startX, y);
    doc.text('Empleado', startX + 60, y, { width: 80 });
    doc.text('Empresa', startX + 140, y, { width: 70 });
    doc.text('Evento', startX + 210, y, { width: 80 });
    doc.text('Área', startX + 290, y, { width: 50 });
    doc.text('Ent', startX + 340, y);
    doc.text('Sal', startX + 365, y);
    doc.text('Trab', startX + 390, y);
    doc.text('Extra', startX + 420, y);
    doc.text('$Ext', startX + 455, y);   // Valor horas extra
    doc.text('$Fijo', startX + 495, y);  // Valor fijo
    doc.text('Total', startX + 535, y);  // Sueldo total

    doc.moveTo(startX, y + 12).lineTo(580, y + 12).stroke();
    y += 16;

    rows.forEach((row) => {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }

      // Horas base y extra
      let base = row.horas_trabajadas;
      let extra = row.horas_extra;

      if (base == null || extra == null) {
        const calc = calcularHorasBaseYExtra(
          row.hora_entrada,
          row.hora_salida
        );
        base = calc.base;
        extra = calc.extra;
      }

      const horasTrab = base || 0;
      const horasExtra = extra || 0;

      // Valores monetarios (desde BD o recalculados)
      let valor_horas_extra = row.valor_horas_extra;
      let valor_fijo = row.valor_fijo;
      let sueldo_total = row.sueldo_total;

      if (valor_horas_extra == null || valor_fijo == null || sueldo_total == null) {
        valor_fijo = horasTrab * TARIFA_HORA;
        valor_horas_extra = horasExtra * TARIFA_HORA_EXTRA;
        sueldo_total = valor_fijo + valor_horas_extra;
      }

      doc.fontSize(9);
      doc.text(row.fecha || '', startX, y);
      doc.text(row.empleado_nombre || '', startX + 60, y, { width: 80 });
      doc.text(row.empresa_nombre || '', startX + 140, y, { width: 70 });
      doc.text(row.nombre_evento || '', startX + 210, y, { width: 80 });
      doc.text(row.area || '', startX + 290, y, { width: 50 });
      doc.text(formatearHora(row.hora_entrada), startX + 340, y);
      doc.text(formatearHora(row.hora_salida), startX + 365, y);
      doc.text(base != null ? base.toFixed(2) : '', startX + 390, y);
      doc.text(extra != null ? extra.toFixed(2) : '', startX + 420, y);
      doc.text(
        valor_horas_extra != null ? valor_horas_extra.toFixed(0) : '',
        startX + 455,
        y
      );
      doc.text(
        valor_fijo != null ? valor_fijo.toFixed(0) : '',
        startX + 495,
        y
      );
      doc.text(
        sueldo_total != null ? sueldo_total.toFixed(0) : '',
        startX + 535,
        y
      );

      y += 14;
    });

    doc.end();
  });
});

module.exports = router;
