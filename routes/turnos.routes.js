// routes/turnos.routes.js
const express = require('express');
const db = require('../db');
const { calcularHorasBaseYExtra } = require('../helpers/tiempo');

const router = express.Router();

// Tarifas (puedes ajustarlas aquí)
const TARIFA_HORA = 4750;          // valor por hora normal
const TARIFA_HORA_EXTRA = 4750;    // valor por hora extra

// ============================
//   Registrar ENTRADA automática
// ============================
router.post('/turnos/entrada', (req, res) => {
  const { empleado_id, empresa_id, nombre_evento, area } = req.body;

  if (!empleado_id) {
    return res.status(400).json({ error: 'empleado_id es obligatorio' });
  }

  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10);
  const hora_entrada = ahora.toISOString();

  db.run(
    `
    INSERT INTO turnos
      (empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area,
       horas_trabajadas, horas_extra, valor_horas_extra, valor_fijo, sueldo_total)
    VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)
    `,
    [
      empleado_id,
      fecha,
      hora_entrada,
      empresa_id || null,
      nombre_evento || null,
      area || null,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al registrar entrada' });
      }

      res.status(201).json({
        id: this.lastID,
        empleado_id,
        fecha,
        hora_entrada,
        hora_salida: null,
        empresa_id: empresa_id || null,
        nombre_evento: nombre_evento || null,
        area: area || null,
        horas_trabajadas: null,
        horas_extra: null,
        valor_horas_extra: null,
        valor_fijo: null,
        sueldo_total: null,
      });
    }
  );
});

// ============================
//   Registrar SALIDA automática
// ============================
router.post('/turnos/salida', (req, res) => {
  const { empleado_id } = req.body;

  if (!empleado_id) {
    return res.status(400).json({ error: 'empleado_id es obligatorio' });
  }

  const hora_salida = new Date().toISOString();

  db.get(
    `
    SELECT id, hora_entrada
    FROM turnos
    WHERE empleado_id = ?
      AND hora_salida IS NULL
    ORDER BY hora_entrada DESC
    LIMIT 1
    `,
    [empleado_id],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al buscar turno abierto' });
      }

      if (!row) {
        return res
          .status(400)
          .json({ error: 'No hay turno abierto para este empleado' });
      }

      const { base, extra } = calcularHorasBaseYExtra(
        row.hora_entrada,
        hora_salida
      );

      const horasTrab = base || 0;
      const horasExtra = extra || 0;

      const valor_fijo = horasTrab * TARIFA_HORA;
      const valor_horas_extra = horasExtra * TARIFA_HORA_EXTRA;
      const sueldo_total = valor_fijo + valor_horas_extra;

      db.run(
        `
        UPDATE turnos
        SET hora_salida = ?,
            horas_trabajadas = ?,
            horas_extra = ?,
            valor_horas_extra = ?,
            valor_fijo = ?,
            sueldo_total = ?
        WHERE id = ?
        `,
        [
          hora_salida,
          horasTrab,
          horasExtra,
          valor_horas_extra,
          valor_fijo,
          sueldo_total,
          row.id,
        ],
        function (err2) {
          if (err2) {
            console.error(err2);
            return res
              .status(500)
              .json({ error: 'Error al registrar salida' });
          }

          res.json({
            id: row.id,
            empleado_id,
            hora_salida,
            horas_trabajadas: horasTrab,
            horas_extra: horasExtra,
            valor_horas_extra,
            valor_fijo,
            sueldo_total,
          });
        }
      );
    }
  );
});

// ============================
//   Crear turno manual
// ============================
router.post('/turnos', (req, res) => {
  const {
    empleado_id,
    fecha,
    hora_entrada,
    hora_salida,
    empresa_id,
    nombre_evento,
    area,
  } = req.body;

  if (!empleado_id || !fecha || !hora_entrada || !nombre_evento || !area) {
    return res.status(400).json({
      error:
        'empleado_id, fecha, hora_entrada, nombre_evento y area son obligatorios',
    });
  }

  const { base, extra } = calcularHorasBaseYExtra(hora_entrada, hora_salida);

  const horasTrab = base || 0;
  const horasExtra = extra || 0;

  const valor_fijo = horasTrab * TARIFA_HORA;
  const valor_horas_extra = horasExtra * TARIFA_HORA_EXTRA;
  const sueldo_total = valor_fijo + valor_horas_extra;

  db.run(
    `
    INSERT INTO turnos
      (empleado_id, fecha, hora_entrada, hora_salida, empresa_id, nombre_evento, area,
       horas_trabajadas, horas_extra, valor_horas_extra, valor_fijo, sueldo_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      empleado_id,
      fecha,
      hora_entrada,
      hora_salida || null,
      empresa_id || null,
      nombre_evento,
      area,
      horasTrab,
      horasExtra,
      valor_horas_extra,
      valor_fijo,
      sueldo_total,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al crear el turno' });
      }

      res.status(201).json({
        id: this.lastID,
        empleado_id,
        fecha,
        hora_entrada,
        hora_salida: hora_salida || null,
        empresa_id: empresa_id || null,
        nombre_evento,
        area,
        horas_trabajadas: horasTrab,
        horas_extra: horasExtra,
        valor_horas_extra,
        valor_fijo,
        sueldo_total,
      });
    }
  );
});

// ============================
//   Editar turno
// ============================
router.put('/turnos/:id', (req, res) => {
  const { id } = req.params;
  const {
    empleado_id,
    fecha,
    hora_entrada,
    hora_salida,
    empresa_id,
    nombre_evento,
    area,
  } = req.body;

  if (!empleado_id || !fecha || !hora_entrada || !nombre_evento || !area) {
    return res.status(400).json({
      error:
        'empleado_id, fecha, hora_entrada, nombre_evento y area son obligatorios',
    });
  }

  const { base, extra } = calcularHorasBaseYExtra(hora_entrada, hora_salida);

  const horasTrab = base || 0;
  const horasExtra = extra || 0;

  const valor_fijo = horasTrab * TARIFA_HORA;
  const valor_horas_extra = horasExtra * TARIFA_HORA_EXTRA;
  const sueldo_total = valor_fijo + valor_horas_extra;

  db.run(
    `
    UPDATE turnos
    SET empleado_id = ?,
        fecha = ?,
        hora_entrada = ?,
        hora_salida = ?,
        empresa_id = ?,
        nombre_evento = ?,
        area = ?,
        horas_trabajadas = ?,
        horas_extra = ?,
        valor_horas_extra = ?,
        valor_fijo = ?,
        sueldo_total = ?
    WHERE id = ?
    `,
    [
      empleado_id,
      fecha,
      hora_entrada,
      hora_salida || null,
      empresa_id || null,
      nombre_evento,
      area,
      horasTrab,
      horasExtra,
      valor_horas_extra,
      valor_fijo,
      sueldo_total,
      id,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al actualizar el turno' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Turno no encontrado' });
      }

      res.json({
        id,
        empleado_id,
        fecha,
        hora_entrada,
        hora_salida: hora_salida || null,
        empresa_id: empresa_id || null,
        nombre_evento,
        area,
        horas_trabajadas: horasTrab,
        horas_extra: horasExtra,
        valor_horas_extra,
        valor_fijo,
        sueldo_total,
      });
    }
  );
});

// ============================
//   Eliminar turno
// ============================
router.delete('/turnos/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM turnos WHERE id = ?',
    [id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al eliminar el turno' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Turno no encontrado' });
      }

      res.json({ message: 'Turno eliminado correctamente' });
    }
  );
});

// ============================
//   Turnos de un empleado (por mes y empresa)
// ============================
router.get('/empleados/:id/turnos', (req, res) => {
  const { id } = req.params;
  let { anio, mes, empresa_id } = req.query;

  const now = new Date();
  if (!anio) anio = String(now.getFullYear());
  if (!mes) mes = String(now.getMonth() + 1).padStart(2, '0');
  else mes = String(mes).padStart(2, '0');

  const filtroMes = `${anio}-${mes}`;

  let sql = `
    SELECT 
      t.id,
      t.empleado_id,
      t.fecha,
      t.hora_entrada,
      t.hora_salida,
      t.empresa_id,
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
      AND substr(t.fecha, 1, 7) = ?
  `;
  const params = [id, filtroMes];

  if (empresa_id) {
    sql += ' AND t.empresa_id = ?';
    params.push(empresa_id);
  }

  sql += ' ORDER BY t.fecha, t.hora_entrada';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener turnos' });
    }
    res.json(rows);
  });
});

// ============================
//   Vista global de turnos (JSON)
// ============================
router.get('/turnos', (req, res) => {
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
      return res
        .status(500)
        .json({ error: 'Error al obtener turnos globales' });
    }
    res.json(rows);
  });
});

module.exports = router;
