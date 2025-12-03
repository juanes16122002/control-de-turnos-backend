// routes/exportEmpleado.routes.js
const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { formatearHora, calcularHorasBaseYExtra } = require('../helpers/tiempo');

const router = express.Router();

// Excel por empleado
router.get('/empleados/:id/turnos/excel', (req, res) => {
  const { id } = req.params;
  let { anio, mes, empresa_id, desde, hasta } = req.query;

  const now = new Date();
  const usaRango = !!(desde && hasta);

  if (!usaRango) {
    if (!anio) anio = String(now.getFullYear());
    if (!mes) mes = String(now.getMonth() + 1).padStart(2, '0');
    else mes = String(mes).padStart(2, '0');
  }

  const filtroMes = !usaRango ? `${anio}-${mes}` : null;

  db.get(
    'SELECT nombre FROM empleados WHERE id = ?',
    [id],
    (err, empleado) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener empleado' });
      }
      if (!empleado) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }

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
          e.nombre AS empresa_nombre
        FROM turnos t
        LEFT JOIN empresas e ON t.empresa_id = e.id
        WHERE t.empleado_id = ?
      `;
      const params = [id];

      if (usaRango) {
        sql += ' AND t.fecha >= ? AND t.fecha <= ?';
        params.push(desde, hasta);
      } else {
        sql += ' AND substr(t.fecha, 1, 7) = ?';
        params.push(filtroMes);
      }

      if (empresa_id) {
        sql += ' AND t.empresa_id = ?';
        params.push(empresa_id);
      }

      sql += ' ORDER BY t.fecha, t.hora_entrada';

      db.all(sql, params, async (err2, rows) => {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: 'Error al obtener turnos' });
        }

        try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Turnos');

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
              empleado.nombre,
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

          const labelPeriodo = usaRango
            ? `${desde}_a_${hasta}`
            : filtroMes;

          res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          res.setHeader(
            'Content-Disposition',
            `attachment; filename=turnos_${empleado.nombre.replace(
              /\s+/g,
              '_'
            )}_${labelPeriodo}.xlsx`
          );

          await workbook.xlsx.write(res);
          res.end();
        } catch (e) {
          console.error(e);
          res.status(500).json({ error: 'Error al generar Excel' });
        }
      });
    }
  );
});

// PDF por empleado
router.get('/empleados/:id/turnos/pdf', (req, res) => {
  const { id } = req.params;
  let { anio, mes, empresa_id, desde, hasta } = req.query;

  const now = new Date();
  const usaRango = !!(desde && hasta);

  if (!usaRango) {
    if (!anio) anio = String(now.getFullYear());
    if (!mes) mes = String(now.getMonth() + 1).padStart(2, '0');
    else mes = String(mes).padStart(2, '0');
  }

  const filtroMes = !usaRango ? `${anio}-${mes}` : null;

  db.get(
    'SELECT nombre FROM empleados WHERE id = ?',
    [id],
    (err, empleado) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener empleado' });
      }
      if (!empleado) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }

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
          e.nombre AS empresa_nombre
        FROM turnos t
        LEFT JOIN empresas e ON t.empresa_id = e.id
        WHERE t.empleado_id = ?
      `;
      const params = [id];

      if (usaRango) {
        sql += ' AND t.fecha >= ? AND t.fecha <= ?';
        params.push(desde, hasta);
      } else {
        sql += ' AND substr(t.fecha, 1, 7) = ?';
        params.push(filtroMes);
      }

      if (empresa_id) {
        sql += ' AND t.empresa_id = ?';
        params.push(empresa_id);
      }

      sql += ' ORDER BY t.fecha, t.hora_entrada';

      db.all(sql, params, (err2, rows) => {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: 'Error al obtener turnos' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        const labelPeriodo = usaRango ? `${desde}_a_${hasta}` : filtroMes;
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=turnos_${empleado.nombre.replace(
            /\s+/g,
            '_'
          )}_${labelPeriodo}.pdf`
        );

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        doc.pipe(res);

        doc.fontSize(14).text(
          `Turnos de ${empleado.nombre} - ${
            usaRango ? `${desde} a ${hasta}` : filtroMes
          }`,
          { align: 'center' }
        );
        doc.moveDown();

        const startX = 30;
        let y = doc.y;

        doc.fontSize(10);
        doc.text('Fecha', startX, y);
        doc.text('Empresa', startX + 70, y, { width: 110 });
        doc.text('Evento', startX + 180, y, { width: 110 });
        doc.text('Área', startX + 290, y, { width: 70 });
        doc.text('Ent', startX + 360, y);
        doc.text('Sal', startX + 390, y);
        doc.text('Trab', startX + 420, y);
        doc.text('Extra', startX + 470, y);

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
          doc.text(row.empresa_nombre || '', startX + 70, y, { width: 110 });
          doc.text(row.nombre_evento || '', startX + 180, y, { width: 110 });
          doc.text(row.area || '', startX + 290, y, { width: 70 });
          doc.text(formatearHora(row.hora_entrada), startX + 360, y);
          doc.text(formatearHora(row.hora_salida), startX + 390, y);
          doc.text(base != null ? base.toFixed(2) : '', startX + 420, y);
          doc.text(extra != null ? extra.toFixed(2) : '', startX + 470, y);

          y += 14;
        });

        doc.end();
      });
    }
  );
});

module.exports = router;
