const turnosService = require('../services/turnos.service');
const exportService = require('../services/export.service');
const catchAsync = require('../middlewares/catchAsync');

exports.excel = catchAsync(async (req, res) => {
  const rows = await turnosService.global(req.query);
  const workbook = exportService.generarExcelGlobal(rows);
  const { desde, hasta } = req.query;
  const labelPeriodo = desde && hasta ? `${desde}_a_${hasta}` : 'periodo';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=turnos_formato_cliente_${labelPeriodo}.xlsx`);
  workbook.xlsx.write(res).then(() => res.end());
});

exports.pdf = catchAsync(async (req, res) => {
  const rows = await turnosService.global(req.query);
  const { desde, hasta } = req.query;
  const labelPeriodo = desde && hasta ? `${desde}_a_${hasta}` : 'periodo';
  const titulo = `Turnos ${desde && hasta ? `de ${desde} a ${hasta}` : ' sin rango definido'}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=turnos_global_${labelPeriodo}.pdf`);
  exportService.generarPDFGlobal(titulo, rows, res);
});
