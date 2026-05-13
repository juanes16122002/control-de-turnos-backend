const { pool } = require('../db');
const turnosService = require('../services/turnos.service');
const exportService = require('../services/export.service');
const catchAsync = require('../middlewares/catchAsync');
const AppError = require('../utils/AppError');

exports.excel = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { rows: empRows } = await pool.query('SELECT nombre FROM empleados WHERE id = $1', [id]);
  const empleado = empRows[0];
  if (!empleado) throw new AppError(404, 'Empleado no encontrado');

  const rows = await turnosService.porEmpleado(id, req.query);
  const { desde, hasta, anio, mes } = req.query;
  const usaRango = !!(desde && hasta);
  const labelPeriodo = usaRango ? `${desde}_a_${hasta}` : `${anio || new Date().getFullYear()}-${(mes || String(new Date().getMonth() + 1)).padStart(2, '0')}`;

  const workbook = exportService.generarExcelEmpleado(empleado, rows);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=turnos_${empleado.nombre.replace(/\s+/g, '_')}_${labelPeriodo}.xlsx`);
  workbook.xlsx.write(res).then(() => res.end());
});

exports.pdf = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { rows: empRows } = await pool.query('SELECT nombre FROM empleados WHERE id = $1', [id]);
  const empleado = empRows[0];
  if (!empleado) throw new AppError(404, 'Empleado no encontrado');

  const rows = await turnosService.porEmpleado(id, req.query);
  const { desde, hasta, anio, mes } = req.query;
  const usaRango = !!(desde && hasta);
  const periodo = usaRango ? `${desde} a ${hasta}` : `${anio || new Date().getFullYear()}-${(mes || String(new Date().getMonth() + 1)).padStart(2, '0')}`;
  const labelPeriodo = periodo.replace(/ /g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=turnos_${empleado.nombre.replace(/\s+/g, '_')}_${labelPeriodo}.pdf`);
  exportService.generarPDFEmpleado(empleado, periodo, rows, res);
});
