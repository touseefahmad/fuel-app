const { Router } = require('../router');
const { all, get, run, transaction } = require('../db');
const { requireAuth, requireSiteAccess } = require('../middleware');
const { dipToLiters } = require('../utils/calibration');
const { buildDailySummary } = require('../utils/summary');
const { today, pastDate } = require('../utils/date');

const router = new Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function prevClosingDip(tankId, beforeDate) {
  const row = get(
    `SELECT tr.closing_dip_mm FROM tank_readings tr
     JOIN daily_entries de ON de.id = tr.daily_entry_id
     WHERE tr.tank_id = ? AND de.entry_date < ?
     ORDER BY de.entry_date DESC LIMIT 1`,
    [tankId, beforeDate]
  );
  return row ? row.closing_dip_mm : null;
}

function prevClosingMeter(nozzleId, beforeDate) {
  const row = get(
    `SELECT nr.closing_meter FROM nozzle_readings nr
     JOIN daily_entries de ON de.id = nr.daily_entry_id
     WHERE nr.nozzle_id = ? AND de.entry_date < ?
     ORDER BY de.entry_date DESC LIMIT 1`,
    [nozzleId, beforeDate]
  );
  return row ? row.closing_meter : null;
}

// List entries in a date range for a site, with quick status + totals.
router.get('/api/sites/:siteId/entries', requireAuth, requireSiteAccess, (req, res) => {
  const from = req.query.from || pastDate(30);
  const to = req.query.to || today();
  const rows = all(
    `SELECT * FROM daily_entries WHERE site_id = ? AND entry_date BETWEEN ? AND ? ORDER BY entry_date DESC`,
    [req.siteId, from, to]
  );
  const enriched = rows.map((entry) => {
    const summary = buildDailySummary(req.siteId, entry.entry_date, entry.id);
    return { ...entry, totals: summary.totals };
  });
  res.json({ entries: enriched, from, to });
});

// Get (or virtually create) the entry for one date, prefilled from the
// previous day's closing readings when no entry exists yet.
router.get('/api/sites/:siteId/entries/:date', requireAuth, requireSiteAccess, (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return res.error('Invalid date, expected YYYY-MM-DD', 400);

  const tanks = all(
    `SELECT t.*, p.name as product_name, p.short_code FROM tanks t
     JOIN products p ON p.id = t.product_id
     WHERE t.site_id = ? AND t.active = 1 ORDER BY p.id, t.id`,
    [req.siteId]
  );
  const nozzles = all(
    `SELECT n.*, t.product_id FROM nozzles n JOIN tanks t ON t.id = n.tank_id
     WHERE n.site_id = ? AND n.active = 1 ORDER BY n.id`,
    [req.siteId]
  );

  let entry = get('SELECT * FROM daily_entries WHERE site_id = ? AND entry_date = ?', [req.siteId, date]);

  const tankReadings = tanks.map((tank) => {
    const existing = entry
      ? get('SELECT * FROM tank_readings WHERE daily_entry_id = ? AND tank_id = ?', [entry.id, tank.id])
      : null;
    const opening_dip_mm = existing ? existing.opening_dip_mm : prevClosingDip(tank.id, date);
    return {
      tank_id: tank.id,
      tank_name: tank.name,
      product_id: tank.product_id,
      product_name: tank.product_name,
      capacity_liters: tank.capacity_liters,
      opening_dip_mm,
      closing_dip_mm: existing ? existing.closing_dip_mm : null,
      receipt_liters: existing ? existing.receipt_liters : 0,
      receipt_invoice_no: existing ? existing.receipt_invoice_no : null,
    };
  });

  const nozzleReadings = nozzles.map((nozzle) => {
    const existing = entry
      ? get('SELECT * FROM nozzle_readings WHERE daily_entry_id = ? AND nozzle_id = ?', [entry.id, nozzle.id])
      : null;
    const opening_meter = existing ? existing.opening_meter : prevClosingMeter(nozzle.id, date);
    return {
      nozzle_id: nozzle.id,
      nozzle_name: nozzle.name,
      product_id: nozzle.product_id,
      opening_meter,
      closing_meter: existing ? existing.closing_meter : null,
      test_liters: existing ? existing.test_liters : 0,
    };
  });

  const summary = buildDailySummary(req.siteId, date, entry ? entry.id : null);

  res.json({
    entry: entry || { site_id: req.siteId, entry_date: date, status: 'draft', id: null },
    tank_readings: tankReadings,
    nozzle_readings: nozzleReadings,
    summary,
  });
});

// Create/update the entry for a date: upserts the daily_entries row plus
// all tank_readings and nozzle_readings, recomputing derived liters.
router.put('/api/sites/:siteId/entries/:date', requireAuth, requireSiteAccess, (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return res.error('Invalid date, expected YYYY-MM-DD', 400);

  const existing = get('SELECT * FROM daily_entries WHERE site_id = ? AND entry_date = ?', [req.siteId, date]);
  if (existing && existing.status === 'finalized' && req.user.role !== 'owner') {
    return res.error('This day is finalized. Ask the owner to reopen it before editing.', 403);
  }

  const tankInputs = Array.isArray(req.body.tank_readings) ? req.body.tank_readings : [];
  const nozzleInputs = Array.isArray(req.body.nozzle_readings) ? req.body.nozzle_readings : [];
  const notes = req.body.notes ?? null;

  transaction(() => {
    let entryId;
    if (existing) {
      run('UPDATE daily_entries SET notes = ?, updated_by = ?, updated_at = datetime(\'now\') WHERE id = ?', [notes, req.user.id, existing.id]);
      entryId = existing.id;
    } else {
      const result = run(
        'INSERT INTO daily_entries (site_id, entry_date, notes, created_by, updated_by) VALUES (?,?,?,?,?)',
        [req.siteId, date, notes, req.user.id, req.user.id]
      );
      entryId = Number(result.lastInsertRowid);
    }

    for (const t of tankInputs) {
      const tank = get('SELECT * FROM tanks WHERE id = ? AND site_id = ?', [t.tank_id, req.siteId]);
      if (!tank) continue;
      const calibration = all('SELECT dip_mm, liters FROM tank_calibration WHERE tank_id = ?', [tank.id]);
      const opening_stock_liters = dipToLiters(calibration, t.opening_dip_mm);
      const closing_stock_liters = dipToLiters(calibration, t.closing_dip_mm);
      const receipt_liters = Number(t.receipt_liters) || 0;
      const already = get('SELECT id FROM tank_readings WHERE daily_entry_id = ? AND tank_id = ?', [entryId, tank.id]);
      if (already) {
        run(
          `UPDATE tank_readings SET opening_dip_mm=?, closing_dip_mm=?, opening_stock_liters=?, closing_stock_liters=?, receipt_liters=?, receipt_invoice_no=? WHERE id=?`,
          [t.opening_dip_mm ?? null, t.closing_dip_mm ?? null, opening_stock_liters, closing_stock_liters, receipt_liters, t.receipt_invoice_no ?? null, already.id]
        );
      } else {
        run(
          `INSERT INTO tank_readings (daily_entry_id, tank_id, opening_dip_mm, closing_dip_mm, opening_stock_liters, closing_stock_liters, receipt_liters, receipt_invoice_no)
           VALUES (?,?,?,?,?,?,?,?)`,
          [entryId, tank.id, t.opening_dip_mm ?? null, t.closing_dip_mm ?? null, opening_stock_liters, closing_stock_liters, receipt_liters, t.receipt_invoice_no ?? null]
        );
      }
    }

    for (const n of nozzleInputs) {
      const nozzle = get('SELECT * FROM nozzles WHERE id = ? AND site_id = ?', [n.nozzle_id, req.siteId]);
      if (!nozzle) continue;
      const test_liters = Number(n.test_liters) || 0;
      let liters_sold = null;
      if (n.closing_meter !== null && n.closing_meter !== undefined && n.closing_meter !== '' &&
          n.opening_meter !== null && n.opening_meter !== undefined && n.opening_meter !== '') {
        liters_sold = Number(n.closing_meter) - Number(n.opening_meter) - test_liters;
      }
      const already = get('SELECT id FROM nozzle_readings WHERE daily_entry_id = ? AND nozzle_id = ?', [entryId, nozzle.id]);
      if (already) {
        run(
          `UPDATE nozzle_readings SET opening_meter=?, closing_meter=?, test_liters=?, liters_sold=? WHERE id=?`,
          [n.opening_meter ?? null, n.closing_meter ?? null, test_liters, liters_sold, already.id]
        );
      } else {
        run(
          `INSERT INTO nozzle_readings (daily_entry_id, nozzle_id, opening_meter, closing_meter, test_liters, liters_sold)
           VALUES (?,?,?,?,?,?)`,
          [entryId, nozzle.id, n.opening_meter ?? null, n.closing_meter ?? null, test_liters, liters_sold]
        );
      }
    }
  });

  const entry = get('SELECT * FROM daily_entries WHERE site_id = ? AND entry_date = ?', [req.siteId, date]);
  const summary = buildDailySummary(req.siteId, date, entry.id);
  res.json({ entry, summary });
});

router.post('/api/sites/:siteId/entries/:date/finalize', requireAuth, requireSiteAccess, (req, res) => {
  const entry = get('SELECT * FROM daily_entries WHERE site_id = ? AND entry_date = ?', [req.siteId, req.params.date]);
  if (!entry) return res.error('No entry saved for this date yet', 404);
  run('UPDATE daily_entries SET status = ? WHERE id = ?', [req.body.status === 'finalized' ? 'finalized' : 'draft', entry.id]);
  res.json({ entry: get('SELECT * FROM daily_entries WHERE id = ?', [entry.id]) });
});

module.exports = router;
