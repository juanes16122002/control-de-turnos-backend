const dashboardService = require('../services/dashboard.service');
const catchAsync = require('../middlewares/catchAsync');

exports.stats = catchAsync(async (req, res) => {
  const data = await dashboardService.stats();
  res.json(data);
});
