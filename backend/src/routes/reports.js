const { Router } = require('../router');
const { all, get } = require('../db');
const { requireAuth, requireSiteAccess } = require('../middleware');
const { buildDailySummary } = require('../utils/summary');
const { today, pastDate } = require('../utils/date');

const router = new Router();

router.get('/api/sites/:siteId/reports/export.csv', requireAuth, requireSiteAccess, (req, res) => {
  const from = req.query.from || pastDate(30);
  const to = req.query.to || today();
  const site = get('SELECT * FROM sites WHERE id = ?', [req.siteId]);

  const rows = all(
    `SELECT entry_date, id FROM daily_entries WHERE site_id = ? AND entry_date BETWEEN ? AND ? ORDER BY entry_date`,
    [req.siteId, from, to]
  );

  const header = [
    'Date', 'Product', 'Opening Stock (L)', 'Receipts (L)', 'Meter Sales (L)',
    'Expected Closing (L)', 'Actual Closing - Dip (L)', 'Variance (L)', 'Variance Type',
    'Price/Liter', 'Sales Amount', 'Variance Amount', 'Closing Stock Value',
  ];
  const lines = [header.join(',')];

  for (const row of rows) {
    const summary = buildDailySummary(req.siteId, row.entry_date, row.id);
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
