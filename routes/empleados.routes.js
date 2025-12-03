// routes/empleados.routes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Asegúrate de que db.js haga: module.exports = db;

// Crear empleado
router.post('/empleados', (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  db.run(
    'INSERT INTO empleados (nombre) VALUES (?)',
    [nombre],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al crear empleado' });
      }

      res.status(201).json({ id: this.lastID, nombre });
    }
  );
});

// Obtener todos los empleados
router.get('/empleados', (req, res) => {
  db.all(
    'SELECT id, nombre FROM empleados ORDER BY nombre',
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener empleados' });
      }
      res.json(rows);
    }
  );
});

// 🔹 Editar / renombrar empleado
router.put('/empleados/:id', (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  db.run(
    'UPDATE empleados SET nombre = ? WHERE id = ?',
    [nombre.trim(), id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al actualizar empleado' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }

      res.json({ id, nombre: nombre.trim() });
    }
  );
});

// Eliminar empleado (y sus turnos por ON DELETE CASCADE)
router.delete('/empleados/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM empleados WHERE id = ?',
    [id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al eliminar el empleado' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }

      res.json({ message: 'Empleado eliminado correctamente' });
    }
  );
});

module.exports = router;
