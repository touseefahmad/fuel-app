const { Router } = require('../router');
const { all, get } = require('../db');
const { requireAuth } = require('../middleware');
const { buildDailySummary } = require('../utils/summary');
const { today, pastDate, enumerateDates } = require('../utils/date');

const router = new Router();

function accessibleSites(req) {
  if (req.user.role === 'owner') return all('SELECT * FROM sites ORDER BY id');
  return all('SELECT * FROM sites WHERE id = ?', [req.user.site_id]);
}

router.get('/api/dashboard', requireAuth, (req, res) => {
  const from = req.query.from || pastDate(13);
  const to = req.query.to || today();

  let sites = accessibleSites(req);
  if (req.query.site_id && req.query.site_id !== 'all') {
    const siteId = Number(req.query.site_id);
    if (req.user.role !== 'owner' && req.user.site_id !== siteId) return res.error('Forbidden', 403);
    sites = sites.filter((s) => s.id === siteId);
    if (sites.length === 0) return res.error('Site not found or not accessible', 404);
  }

  const products = all('SELECT * FROM products ORDER BY id');
  const dateList = enumerateDates(from, to);

  const series = dateList.map((date) => {
    let sales_liters = 0, sales_amount = 0, variance_liters = 0, variance_amount = 0, closing_stock_value = 0;
    for (const site of sites) {
      const entry = get('SELECT id FROM daily_entries WHERE site_id = ? AND entry_date = ?', [site.id, date]);
      const summary = buildDailySummary(site.id, date, entry ? entry.id : null);
      sales_liters += summary.totals.meter_sales_liters || 0;
      sales_amount += summary.totals.meter_sales_amount || 0;
      variance_liters += summary.products.reduce((a, p) => a + (p.variance_liters || 0), 0);
      variance_amount += summary.totals.variance_amount || 0;
      closing_stock_value += summary.totals.closing_stock_value || 0;
    }
    return {
      date,
      sales_liters: round2(sales_liters),
      sales_amount: round2(sales_amount),
      variance_liters: round2(variance_liters),
      variance_amount: round2(variance_amount),
    };
  });

  const perProductTotals = products.map((product) => {
    let sales_liters = 0, sales_amount = 0, variance_liters = 0, variance_amount = 0, latest_closing = 0;
    for (const site of sites) {
      for (const date of dateList) {
        const entry = get('SELECT id FROM daily_entries WHERE site_id = ? AND entry_date = ?', [site.id, date]);
        const summary = buildDailySummary(site.id, date, entry ? entry.id : null);
        const p = summary.products.find((x) => x.product_id === product.id);
        if (!p) continue;
        sales_liters += p.meter_sales_liters || 0;
        sales_amount += p.sales_amount || 0;
        variance_liters += p.variance_liters || 0;
        variance_amount += p.variance_amount || 0;
        if (date === dateList[dateList.length - 1]) latest_closing += p.actual_closing_liters || 0;
      }
    }
    return {
      product_id: product.id,
      product_name: product.name,
      sales_liters: round2(sales_liters),
      sales_amount: round2(sales_amount),
      variance_liters: round2(variance_liters),
      variance_amount: round2(variance_amount),
      latest_closing_stock_liters: round2(latest_closing),
    };
  });

  const totals = {
    sales_liters: round2(series.reduce((a, s) => a + s.sales_liters, 0)),
    sales_amount: round2(series.reduce((a, s) => a + s.sales_amount, 0)),
    variance_liters: round2(series.reduce((a, s) => a + s.variance_liters, 0)),
    variance_amount: round2(series.reduce((a, s) => a + s.variance_amount, 0)),
  };

  const siteBreakdown = sites.map((site) => {
    const latestEntry = get(
      `SELECT entry_date FROM daily_entries WHERE site_id = ? AND entry_date <= ? ORDER BY entry_date DESC LIMIT 1`,
      [site.id, to]
    );
    const summary = latestEntry
      ? buildDailySummary(site.id, latestEntry.entry_date, get('SELECT id FROM daily_entries WHERE site_id=? AND entry_date=?', [site.id, latestEntry.entry_date]).id)
      : buildDailySummary(site.id, to, null);
    return {
      site_id: site.id,
      site_name: site.name,
      brand: site.brand,
      as_of: latestEntry ? latestEntry.entry_date : null,
      products: summary.products,
    };
  });

  res.json({ from, to, sites: sites.map((s) => ({ id: s.id, name: s.name, brand: s.brand })), series, perProductTotals, totals, siteBreakdown });
});

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

module.exports = router;
