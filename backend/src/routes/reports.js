const { Router } = require('../router');
const { getDb } = require('../db');
const { requireAuth, requireSiteAccess } = require('../middleware');
const { buildDailySummary } = require('../utils/summary');
const { today, pastDate } = require('../utils/date');

const router = new Router();

router.get('/api/sites/:siteId/reports/export.csv', requireAuth, requireSiteAccess, async (req, res) => {
  const from = req.query.from || pastDate(30);
  const to = req.query.to || today();
  const db = getDb();
  const site = await db.collection('sites').findOne({ _id: req.siteId });

  const rows = await db.collection('daily_entries')
    .find({ site_id: req.siteId, entry_date: { $gte: from, $lte: to } })
    .sort({ entry_date: 1 })
    .toArray();

  const header = [
    'Date', 'Product', 'Opening Stock (L)', 'Receipts (L)', 'Meter Sales (L)',
    'Expected Closing (L)', 'Actual Closing - Dip (L)', 'Variance (L)', 'Variance Type',
    'Price/Liter', 'Sales Amount', 'Variance Amount', 'Closing Stock Value',
  ];
  const lines = [header.join(',')];

  for (const row of rows) {
    const summary = await buildDailySummary(req.siteId, row.entry_date, row);
    for (const p of summary.products) {
      lines.push([
        row.entry_date, p.product_name, p.opening_stock_liters, p.receipts_liters, p.meter_sales_liters,
        p.expected_closing_liters, p.actual_closing_liters, p.variance_liters, p.variance_type,
        p.price_per_liter ?? '', p.sales_amount ?? '', p.variance_amount ?? '', p.closing_stock_value ?? '',
      ].join(','));
    }
  }

  const csv = lines.join('\n');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${(site?.code || 'site')}_${from}_to_${to}.csv"`);
  res.end(csv);
});

module.exports = router;
