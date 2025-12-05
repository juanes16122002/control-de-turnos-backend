// routes/exportEmpleado.routes.js
const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { formatearHora, calcularHorasBaseYExtra } = require('../helpers/tiempo');

const router = express.Router();

// Tarifas (deben coincidir con turnos.routes.js)
const TARIFA_HORA = 3750;          // valor por hora normal
const TARIFA_HORA_EXTRA = 3750;    // valor por hora extra

// =======================================================
//                 Excel por empleado
// =======================================================
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
          t.valor_horas_extra,
          t.valor_fijo,
          t.sueldo_total,
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

          // Encabezados
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
            'Valor horas extra',
            'Valor fijo',
            'Sueldo total',
          ]);

          let totalHorasTrab = 0;
          let totalHorasExtra = 0;
          let totalValorHorasExtra = 0;
          let totalValorFijo = 0;
          let totalSueldo = 0;

          rows.forEach((row) => {
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

            // Valores monetarios: usar BD si están, si no, calcular
            let valor_horas_extra = row.valor_horas_extra;
            let valor_fijo = row.valor_fijo;
            let sueldo_total = row.sueldo_total;

            if (valor_horas_extra == null || valor_fijo == null || sueldo_total == null) {
              valor_fijo = horasTrab * TARIFA_HORA;
              valor_horas_extra = horasExtra * TARIFA_HORA_EXTRA;
              sueldo_total = valor_fijo + valor_horas_extra;
            }

            totalHorasTrab += horasTrab;
            totalHorasExtra += horasExtra;
            totalValorHorasExtra += valor_horas_extra || 0;
            totalValorFijo += valor_fijo || 0;
            totalSueldo += sueldo_total || 0;

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
              valor_horas_extra != null ? valor_horas_extra : '',
              valor_fijo != null ? valor_fijo : '',
              sueldo_total != null ? sueldo_total : '',
            ]);
          });

          // Fila de totales
          sheet.addRow([]);
          sheet.addRow([
            'TOTALES',
            '',
            '',
            '',
            '',
            '',
            '',
            totalHorasTrab,
            totalHorasExtra,
            totalValorHorasExtra,
            totalValorFijo,
            totalSueldo,
          ]);

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

// =======================================================
//                 PDF por empleado
// =======================================================
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
          t.valor_horas_extra,
          t.valor_fijo,
          t.sueldo_total,
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
        // Encabezados
        doc.text('Fecha', startX, y);
        doc.text('Empresa', startX + 60, y, { width: 80 });
        doc.text('Evento', startX + 140, y, { width: 80 });
        doc.text('Área', startX + 220, y, { width: 50 });
        doc.text('Ent', startX + 270, y);
        doc.text('Sal', startX + 295, y);
        doc.text('Trab', startX + 320, y);
        doc.text('Extra', startX + 360, y);
        doc.text('$Ext', startX + 395, y);   // Valor horas extra
        doc.text('$Fijo', startX + 440, y);  // Valor fijo
        doc.text('Total', startX + 485, y);  // Sueldo total

        doc.moveTo(startX, y + 12).lineTo(580, y + 12).stroke();
        y += 16;

        let totalHorasTrab = 0;
        let totalHorasExtra = 0;
        let totalValorHorasExtra = 0;
        let totalValorFijo = 0;
        let totalSueldo = 0;

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

          const horasTrab = base || 0;
          const horasExtra = extra || 0;

          let valor_horas_extra = row.valor_horas_extra;
          let valor_fijo = row.valor_fijo;
          let sueldo_total = row.sueldo_total;

          if (valor_horas_extra == null || valor_fijo == null || sueldo_total == null) {
            valor_fijo = horasTrab * TARIFA_HORA;
            valor_horas_extra = horasExtra * TARIFA_HORA_EXTRA;
            sueldo_total = valor_fijo + valor_horas_extra;
          }

          totalHorasTrab += horasTrab;
          totalHorasExtra += horasExtra;
          totalValorHorasExtra += valor_horas_extra || 0;
          totalValorFijo += valor_fijo || 0;
          totalSueldo += sueldo_total || 0;

          doc.fontSize(9);
          doc.text(row.fecha || '', startX, y);
          doc.text(row.empresa_nombre || '', startX + 60, y, { width: 80 });
          doc.text(row.nombre_evento || '', startX + 140, y, { width: 80 });
          doc.text(row.area || '', startX + 220, y, { width: 50 });
          doc.text(formatearHora(row.hora_entrada), startX + 270, y);
          doc.text(formatearHora(row.hora_salida), startX + 295, y);
          doc.text(base != null ? base.toFixed(2) : '', startX + 320, y);
          doc.text(extra != null ? extra.toFixed(2) : '', startX + 360, y);
          doc.text(
            valor_horas_extra != null ? valor_horas_extra.toFixed(0) : '',
            startX + 395,
            y
          );
          doc.text(
            valor_fijo != null ? valor_fijo.toFixed(0) : '',
            startX + 440,
            y
          );
          doc.text(
            sueldo_total != null ? sueldo_total.toFixed(0) : '',
            startX + 485,
            y
          );

          y += 14;
        });

        // Resumen de totales al final
        if (y > 720) {
          doc.addPage();
          y = 40;
        }

        doc.moveDown();
        y = doc.y + 10;

        doc.fontSize(11).text('RESUMEN DE TOTALES', startX, y);
        y += 18;

        doc.fontSize(10);
        doc.text(`Total horas trabajadas: ${totalHorasTrab.toFixed(2)}`, startX, y);
        y += 14;
        doc.text(`Total horas extra: ${totalHorasExtra.toFixed(2)}`, startX, y);
        y += 14;
        doc.text(`Total valor horas extra: ${totalValorHorasExtra.toFixed(0)}`, startX, y);
        y += 14;
        doc.text(`Total valor fijo: ${totalValorFijo.toFixed(0)}`, startX, y);
        y += 14;
        doc.text(`Sueldo total: ${totalSueldo.toFixed(0)}`, startX, y);

        doc.end();
      });
    }
  );
});

module.exports = router;
