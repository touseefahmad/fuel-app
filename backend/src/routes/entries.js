const { Router } = require('../router');
const { getDb, nextId, withId } = require('../db');
const { requireAuth, requireSiteAccess } = require('../middleware');
const { dipToLiters } = require('../utils/calibration');
const { buildDailySummary } = require('../utils/summary');
const { today, pastDate } = require('../utils/date');

const router = new Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function prevClosingDip(db, siteId, tankId, beforeDate) {
  const entry = await db.collection('daily_entries')
    .find({ site_id: siteId, entry_date: { $lt: beforeDate }, 'tank_readings.tank_id': tankId })
    .sort({ entry_date: -1 })
    .limit(1)
    .next();
  if (!entry) return null;
  const reading = (entry.tank_readings || []).find((r) => r.tank_id === tankId);
  return reading ? reading.closing_dip_mm : null;
}

async function prevClosingMeter(db, siteId, nozzleId, beforeDate) {
  const entry = await db.collection('daily_entries')
    .find({ site_id: siteId, entry_date: { $lt: beforeDate }, 'nozzle_readings.nozzle_id': nozzleId })
    .sort({ entry_date: -1 })
    .limit(1)
    .next();
  if (!entry) return null;
  const reading = (entry.nozzle_readings || []).find((r) => r.nozzle_id === nozzleId);
  return reading ? reading.closing_meter : null;
}

// List entries in a date range for a site, with quick status + totals.
router.get('/api/sites/:siteId/entries', requireAuth, requireSiteAccess, async (req, res) => {
  const from = req.query.from || pastDate(30);
  const to = req.query.to || today();
  const db = getDb();
  const rows = await db.collection('daily_entries')
    .find({ site_id: req.siteId, entry_date: { $gte: from, $lte: to } })
    .sort({ entry_date: -1 })
    .toArray();

  const enriched = [];
  for (const entry of rows) {
    const summary = await buildDailySummary(req.siteId, entry.entry_date, entry);
    enriched.push({ ...withId(entry), totals: summary.totals });
  }
  res.json({ entries: enriched, from, to });
});

// Get (or virtually create) the entry for one date, prefilled from the
// previous day's closing readings when no entry exists yet.
router.get('/api/sites/:siteId/entries/:date', requireAuth, requireSiteAccess, async (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return res.error('Invalid date, expected YYYY-MM-DD', 400);
  const db = getDb();

  const tanks = await db.collection('tanks').find({ site_id: req.siteId, active: true }).toArray();
  const products = await db.collection('products').find({}).toArray();
  const productById = new Map(products.map((p) => [p._id, p]));
  const nozzles = await db.collection('nozzles').find({ site_id: req.siteId, active: true }).toArray();

  const entry = await db.collection('daily_entries').findOne({ site_id: req.siteId, entry_date: date });

  const tankReadings = [];
  for (const tank of tanks.sort((a, b) => a._id - b._id)) {
    const existing = entry ? (entry.tank_readings || []).find((r) => r.tank_id === tank._id) : null;
    const opening_dip_mm = existing ? existing.opening_dip_mm : await prevClosingDip(db, req.siteId, tank._id, date);
    tankReadings.push({
      tank_id: tank._id,
      tank_name: tank.name,
      product_id: tank.product_id,
      product_name: productById.get(tank.product_id)?.name,
      capacity_liters: tank.capacity_liters,
      opening_dip_mm,
      closing_dip_mm: existing ? existing.closing_dip_mm : null,
      receipt_liters: existing ? existing.receipt_liters : 0,
      receipt_invoice_no: existing ? existing.receipt_invoice_no : null,
    });
  }

  const nozzleReadings = [];
  for (const nozzle of nozzles.sort((a, b) => a._id - b._id)) {
    const tank = tanks.find((t) => t._id === nozzle.tank_id);
    const existing = entry ? (entry.nozzle_readings || []).find((r) => r.nozzle_id === nozzle._id) : null;
    const opening_meter = existing ? existing.opening_meter : await prevClosingMeter(db, req.siteId, nozzle._id, date);
    nozzleReadings.push({
      nozzle_id: nozzle._id,
      nozzle_name: nozzle.name,
      product_id: tank?.product_id,
      opening_meter,
      closing_meter: existing ? existing.closing_meter : null,
      test_liters: existing ? existing.test_liters : 0,
    });
  }

  const summary = await buildDailySummary(req.siteId, date, entry);

  res.json({
    entry: entry ? withId(entry) : { site_id: req.siteId, entry_date: date, status: 'draft', id: null },
    tank_readings: tankReadings,
    nozzle_readings: nozzleReadings,
    summary,
  });
});

// Create/update the entry for a date: upserts the daily_entries document
// (tank_readings + nozzle_readings embedded), recomputing derived liters.
router.put('/api/sites/:siteId/entries/:date', requireAuth, requireSiteAccess, async (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return res.error('Invalid date, expected YYYY-MM-DD', 400);
  const db = getDb();

  const existing = await db.collection('daily_entries').findOne({ site_id: req.siteId, entry_date: date });
  if (existing && existing.status === 'finalized' && req.user.role !== 'owner') {
    return res.error('This day is finalized. Ask the owner to reopen it before editing.', 403);
  }

  const tankInputs = Array.isArray(req.body.tank_readings) ? req.body.tank_readings : [];
  const nozzleInputs = Array.isArray(req.body.nozzle_readings) ? req.body.nozzle_readings : [];
  const notes = req.body.notes ?? null;

  const tanks = await db.collection('tanks').find({ site_id: req.siteId }).toArray();
  const tankById = new Map(tanks.map((t) => [t._id, t]));
  const nozzles = await db.collection('nozzles').find({ site_id: req.siteId }).toArray();
  const nozzleById = new Map(nozzles.map((n) => [n._id, n]));

  const tank_readings = [];
  for (const t of tankInputs) {
    const tank = tankById.get(Number(t.tank_id));
    if (!tank) continue;
    tank_readings.push({
      tank_id: tank._id,
      opening_dip_mm: numOrNull(t.opening_dip_mm),
      closing_dip_mm: numOrNull(t.closing_dip_mm),
      opening_stock_liters: dipToLiters(tank.calibration, t.opening_dip_mm),
      closing_stock_liters: dipToLiters(tank.calibration, t.closing_dip_mm),
      receipt_liters: Number(t.receipt_liters) || 0,
      receipt_invoice_no: t.receipt_invoice_no ?? null,
    });
  }

  const nozzle_readings = [];
  for (const n of nozzleInputs) {
    const nozzle = nozzleById.get(Number(n.nozzle_id));
    if (!nozzle) continue;
    const test_liters = Number(n.test_liters) || 0;
    let liters_sold = null;
    if (notNullish(n.closing_meter) && notNullish(n.opening_meter)) {
      liters_sold = Number(n.closing_meter) - Number(n.opening_meter) - test_liters;
    }
    nozzle_readings.push({
      nozzle_id: nozzle._id,
      opening_meter: numOrNull(n.opening_meter),
      closing_meter: numOrNull(n.closing_meter),
      test_liters,
      liters_sold,
    });
  }

  const now = new Date().toISOString();
  if (existing) {
    await db.collection('daily_entries').updateOne(
      { _id: existing._id },
      { $set: { notes, tank_readings, nozzle_readings, updated_by: req.user._id, updated_at: now } }
    );
  } else {
    const entryId = await nextId('dailyEntries');
    await db.collection('daily_entries').insertOne({
      _id: entryId,
      site_id: req.siteId,
      entry_date: date,
      status: 'draft',
      notes,
      tank_readings,
      nozzle_readings,
      created_by: req.user._id,
      updated_by: req.user._id,
      created_at: now,
      updated_at: now,
    });
  }

  const entry = await db.collection('daily_entries').findOne({ site_id: req.siteId, entry_date: date });
  const summary = await buildDailySummary(req.siteId, date, entry);
  res.json({ entry: withId(entry), summary });
});

router.post('/api/sites/:siteId/entries/:date/finalize', requireAuth, requireSiteAccess, async (req, res) => {
  const db = getDb();
  const entry = await db.collection('daily_entries').findOne({ site_id: req.siteId, entry_date: req.params.date });
  if (!entry) return res.error('No entry saved for this date yet', 404);
  const status = req.body.status === 'finalized' ? 'finalized' : 'draft';
  await db.collection('daily_entries').updateOne({ _id: entry._id }, { $set: { status } });
  res.json({ entry: withId(await db.collection('daily_entries').findOne({ _id: entry._id })) });
});

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function notNullish(v) {
  return v !== null && v !== undefined && v !== '';
}

module.exports = router;
