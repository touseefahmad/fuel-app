const { Router } = require('../router');
const { all, get, run } = require('../db');
const { requireAuth, requireSiteAccess, requireOwner } = require('../middleware');
const { generatePlaceholderCalibration } = require('../utils/calibration');

const router = new Router();

router.get('/api/sites/:siteId/tanks', requireAuth, requireSiteAccess, (req, res) => {
  const tanks = all(
    `SELECT t.*, p.name as product_name, p.short_code
     FROM tanks t JOIN products p ON p.id = t.product_id
     WHERE t.site_id = ? AND t.active = 1 ORDER BY p.id, t.id`,
    [req.siteId]
  );
  res.json({ tanks });
});

router.post('/api/sites/:siteId/tanks', requireAuth, requireSiteAccess, requireOwner, (req, res) => {
  const { product_id, name, capacity_liters } = req.body;
  if (!product_id || !name || !capacity_liters) return res.error('product_id, name and capacity_liters are required', 400);
  const result = run(
    'INSERT INTO tanks (site_id, product_id, name, capacity_liters) VALUES (?,?,?,?)',
    [req.siteId, product_id, name, capacity_liters]
  );
  const tankId = Number(result.lastInsertRowid);
  const placeholder = generatePlaceholderCalibration(Number(capacity_liters));
  for (const row of placeholder) {
    run('INSERT INTO tank_calibration (tank_id, dip_mm, liters) VALUES (?,?,?)', [tankId, row.dip_mm, row.liters]);
  }
  res.json({ tank: get('SELECT * FROM tanks WHERE id = ?', [tankId]) }, 201);
});

router.get('/api/tanks/:tankId/calibration', requireAuth, (req, res) => {
  const tank = get('SELECT * FROM tanks WHERE id = ?', [req.params.tankId]);
  if (!tank) return res.error('Tank not found', 404);
  if (req.user.role !== 'owner' && req.user.site_id !== tank.site_id) return res.error('Forbidden', 403);
  const rows = all('SELECT id, dip_mm, liters FROM tank_calibration WHERE tank_id = ? ORDER BY dip_mm', [req.params.tankId]);
  res.json({ tank, calibration: rows });
});

// Replaces the full calibration chart for a tank (bulk upsert).
router.put('/api/tanks/:tankId/calibration', requireAuth, requireOwner, (req, res) => {
  const tank = get('SELECT * FROM tanks WHERE id = ?', [req.params.tankId]);
  if (!tank) return res.error('Tank not found', 404);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length < 2) return res.error('At least two calibration points (dip_mm, liters) are required', 400);
  for (const r of rows) {
    if (typeof r.dip_mm !== 'number' || typeof r.liters !== 'number') {
      return res.error('Each row needs numeric dip_mm and liters', 400);
    }
  }
  run('DELETE FROM tank_calibration WHERE tank_id = ?', [req.params.tankId]);
  for (const r of rows) {
    run('INSERT INTO tank_calibration (tank_id, dip_mm, liters) VALUES (?,?,?)', [req.params.tankId, r.dip_mm, r.liters]);
  }
  res.json({ ok: true, calibration: all('SELECT id, dip_mm, liters FROM tank_calibration WHERE tank_id = ? ORDER BY dip_mm', [req.params.tankId]) });
});

router.put('/api/tanks/:tankId', requireAuth, requireOwner, (req, res) => {
  const tank = get('SELECT * FROM tanks WHERE id = ?', [req.params.tankId]);
  if (!tank) return res.error('Tank not found', 404);
  const name = req.body.name ?? tank.name;
  const capacity_liters = req.body.capacity_liters ?? tank.capacity_liters;
  run('UPDATE tanks SET name = ?, capacity_liters = ? WHERE id = ?', [name, capacity_liters, req.params.tankId]);
  res.json({ tank: get('SELECT * FROM tanks WHERE id = ?', [req.params.tankId]) });
});

module.exports = router;
