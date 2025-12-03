// routes/empresas.routes.js
const express = require('express');
const db = require('../db');

const router = express.Router();

// Crear empresa
router.post('/empresas', (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  db.run(
    'INSERT INTO empresas (nombre) VALUES (?)',
    [nombre],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al crear empresa' });
      }

      res.status(201).json({ id: this.lastID, nombre });
    }
  );
});

// Obtener todas las empresas
router.get('/empresas', (req, res) => {
  db.all(
    'SELECT id, nombre FROM empresas ORDER BY nombre',
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener empresas' });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
