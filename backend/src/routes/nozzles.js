const { Router } = require('../router');
const { all, get, run } = require('../db');
const { requireAuth, requireSiteAccess, requireOwner } = require('../middleware');

const router = new Router();

router.get('/api/sites/:siteId/nozzles', requireAuth, requireSiteAccess, (req, res) => {
  const nozzles = all(
    `SELECT n.*, t.name as tank_name, t.product_id, p.name as product_name, p.short_code
     FROM nozzles n
     JOIN tanks t ON t.id = n.tank_id
     JOIN products p ON p.id = t.product_id
     WHERE n.site_id = ? AND n.active = 1
     ORDER BY p.id, t.id, n.id`,
    [req.siteId]
  );
  res.json({ nozzles });
});

router.post('/api/sites/:siteId/nozzles', requireAuth, requireSiteAccess, requireOwner, (req, res) => {
  const { tank_id, name } = req.body;
  if (!tank_id || !name) return res.error('tank_id and name are required', 400);
  const tank = get('SELECT * FROM tanks WHERE id = ? AND site_id = ?', [tank_id, req.siteId]);
  if (!tank) return res.error('Tank not found at this site', 404);
  const result = run('INSERT INTO nozzles (site_id, tank_id, name) VALUES (?,?,?)', [req.siteId, tank_id, name]);
  res.json({ nozzle: get('SELECT * FROM nozzles WHERE id = ?', [Number(result.lastInsertRowid)]) }, 201);
});

router.put('/api/nozzles/:id', requireAuth, requireOwner, (req, res) => {
  const nozzle = get('SELECT * FROM nozzles WHERE id = ?', [req.params.id]);
  if (!nozzle) return res.error('Nozzle not found', 404);
  const name = req.body.name ?? nozzle.name;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : nozzle.active;
  run('UPDATE nozzles SET name = ?, active = ? WHERE id = ?', [name, active, req.params.id]);
  res.json({ nozzle: get('SELECT * FROM nozzles WHERE id = ?', [req.params.id]) });
});

module.exports = router;
