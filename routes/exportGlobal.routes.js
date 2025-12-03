// routes/exportGlobal.routes.js
const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { formatearHora, calcularHorasBaseYExtra } = require('../helpers/tiempo');

const router = express.Router();

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
      const sheet = workbook.addWorksheet('Turnos Globales');

      sheet.addRow([
        'Empleado',
        'Fecha',
        'Empresa',
        'Evento',
        'Área',
        'Hora entrada',
        'Hora salida',
        'Horas trabajadas',
        'Horas extra',
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
          row.empleado_nombre || '',
          row.fecha || '',
          row.empresa_nombre || '',
          row.nombre_evento || '',
          row.area || '',
          formatearHora(row.hora_entrada),
          formatearHora(row.hora_salida),
          base != null ? base : '',
          extra != null ? extra : '',
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
        `attachment; filename=turnos_global_${labelPeriodo}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al generar Excel global' });
    }
  });
});

// PDF global
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
    doc.text('Fecha', startX, y);
    doc.text('Empleado', startX + 60, y, { width: 90 });
    doc.text('Empresa', startX + 150, y, { width: 90 });
    doc.text('Evento', startX + 240, y, { width: 90 });
    doc.text('Área', startX + 330, y, { width: 60 });
    doc.text('Ent', startX + 390, y);
    doc.text('Sal', startX + 420, y);
    doc.text('Trab', startX + 450, y);
    doc.text('Extra', startX + 500, y);

    doc.moveTo(startX, y + 12).lineTo(560, y + 12).stroke();
    y += 16;

    rows.forEach((row) => {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }

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

      doc.fontSize(9);
      doc.text(row.fecha || '', startX, y);
      doc.text(row.empleado_nombre || '', startX + 60, y, { width: 90 });
      doc.text(row.empresa_nombre || '', startX + 150, y, { width: 90 });
      doc.text(row.nombre_evento || '', startX + 240, y, { width: 90 });
      doc.text(row.area || '', startX + 330, y, { width: 60 });
      doc.text(formatearHora(row.hora_entrada), startX + 390, y);
      doc.text(formatearHora(row.hora_salida), startX + 420, y);
      doc.text(base != null ? base.toFixed(2) : '', startX + 450, y);
      doc.text(extra != null ? extra.toFixed(2) : '', startX + 500, y);

      y += 14;
    });

    doc.end();
  });
});

module.exports = router;
