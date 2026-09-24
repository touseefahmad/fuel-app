const { Router } = require('../router');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware');
const { buildDailySummary } = require('../utils/summary');
const { today, pastDate, enumerateDates } = require('../utils/date');

const router = new Router();

async function accessibleSites(req) {
  const db = getDb();
  if (req.user.role === 'owner') return db.collection('sites').find({}).sort({ _id: 1 }).toArray();
  return db.collection('sites').find({ _id: req.user.site_id }).toArray();
}

router.get('/api/dashboard', requireAuth, async (req, res) => {
  const from = req.query.from || pastDate(13);
  const to = req.query.to || today();
  const db = getDb();

  let sites = await accessibleSites(req);
  if (req.query.site_id && req.query.site_id !== 'all') {
    const siteId = Number(req.query.site_id);
    if (req.user.role !== 'owner' && req.user.site_id !== siteId) return res.error('Forbidden', 403);
    sites = sites.filter((s) => s._id === siteId);
    if (sites.length === 0) return res.error('Site not found or not accessible', 404);
  }

  const products = await db.collection('products').find({}).sort({ _id: 1 }).toArray();
  const dateList = enumerateDates(from, to);

  // Pre-fetch every entry in range for the sites in scope, keyed by
  // "siteId|date", so the per-day/per-product loops below don't each hit
  // the database individually.
  const entryRows = await db.collection('daily_entries')
    .find({ site_id: { $in: sites.map((s) => s._id) }, entry_date: { $gte: from, $lte: to } })
    .toArray();
  const entryByKey = new Map(entryRows.map((e) => [`${e.site_id}|${e.entry_date}`, e]));

  const series = [];
  for (const date of dateList) {
    let sales_liters = 0, sales_amount = 0, variance_liters = 0, variance_amount = 0;
    for (const site of sites) {
      const entry = entryByKey.get(`${site._id}|${date}`) || null;
      const summary = await buildDailySummary(site._id, date, entry);
      sales_liters += summary.totals.meter_sales_liters || 0;
      sales_amount += summary.totals.meter_sales_amount || 0;
      variance_liters += summary.totals.variance_liters || 0;
      variance_amount += summary.totals.variance_amount || 0;
    }
    series.push({
      date,
      sales_liters: round2(sales_liters),
      sales_amount: round2(sales_amount),
      variance_liters: round2(variance_liters),
      variance_amount: round2(variance_amount),
    });
  }

  const perProductTotals = [];
  for (const product of products) {
    let sales_liters = 0, sales_amount = 0, variance_liters = 0, variance_amount = 0, latest_closing = 0;
    for (const site of sites) {
      for (const date of dateList) {
        const entry = entryByKey.get(`${site._id}|${date}`) || null;
        const summary = await buildDailySummary(site._id, date, entry);
        const p = summary.products.find((x) => x.product_id === product._id);
        if (!p) continue;
        sales_liters += p.meter_sales_liters || 0;
        sales_amount += p.sales_amount || 0;
        variance_liters += p.variance_liters || 0;
        variance_amount += p.variance_amount || 0;
        if (date === dateList[dateList.length - 1]) latest_closing += p.actual_closing_liters || 0;
      }
    }
    perProductTotals.push({
      product_id: product._id,
      product_name: product.name,
      sales_liters: round2(sales_liters),
      sales_amount: round2(sales_amount),
      variance_liters: round2(variance_liters),
      variance_amount: round2(variance_amount),
      latest_closing_stock_liters: round2(latest_closing),
    });
  }

  const totals = {
    sales_liters: round2(series.reduce((a, s) => a + s.sales_liters, 0)),
    sales_amount: round2(series.reduce((a, s) => a + s.sales_amount, 0)),
    variance_liters: round2(series.reduce((a, s) => a + s.variance_liters, 0)),
    variance_amount: round2(series.reduce((a, s) => a + s.variance_amount, 0)),
  };

  const siteBreakdown = [];
  for (const site of sites) {
    // Not limited to the [from, to] window on purpose: this should show the
    // most recent stock on record even if the last saved entry falls
    // outside the selected date range.
    const latestEntry = await db.collection('daily_entries')
      .find({ site_id: site._id, entry_date: { $lte: to } })
      .sort({ entry_date: -1 })
      .limit(1)
      .next();
    const summary = latestEntry
      ? await buildDailySummary(site._id, latestEntry.entry_date, latestEntry)
      : await buildDailySummary(site._id, to, null);
    siteBreakdown.push({
      site_id: site._id,
      site_name: site.name,
      brand: site.brand,
      as_of: latestEntry ? latestEntry.entry_date : null,
      products: summary.products,
    });
  }

  res.json({ from, to, sites: sites.map((s) => ({ id: s._id, name: s.name, brand: s.brand })), series, perProductTotals, totals, siteBreakdown });
});

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

module.exports = router;
