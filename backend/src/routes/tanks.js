const { Router } = require('../router');
const { getDb, nextId, withId, withIds } = require('../db');
const { requireAuth, requireSiteAccess, requireOwner } = require('../middleware');
const { generatePlaceholderCalibration } = require('../utils/calibration');

const router = new Router();

router.get('/api/sites/:siteId/tanks', requireAuth, requireSiteAccess, async (req, res) => {
  const db = getDb();
  const tanks = await db.collection('tanks').find({ site_id: req.siteId, active: true }).toArray();
  const products = await db.collection('products').find({}).toArray();
  const productById = new Map(products.map((p) => [p._id, p]));
  const enriched = tanks
    .sort((a, b) => (a.product_id - b.product_id) || (a._id - b._id))
    .map((t) => {
      const product = productById.get(t.product_id);
      return { ...withId(t), product_name: product?.name, short_code: product?.short_code };
    });
  res.json({ tanks: enriched });
});

router.post('/api/sites/:siteId/tanks', requireAuth, requireSiteAccess, requireOwner, async (req, res) => {
  const { product_id, name, capacity_liters } = req.body;
  if (!product_id || !name || !capacity_liters) return res.error('product_id, name and capacity_liters are required', 400);
  const db = getDb();
  const tankId = await nextId('tanks');
  const calibration = generatePlaceholderCalibration(Number(capacity_liters));
  const tank = {
    _id: tankId,
    site_id: req.siteId,
    product_id: Number(product_id),
    name,
    capacity_liters: Number(capacity_liters),
    dip_unit: 'mm',
    active: true,
    calibration,
    created_at: new Date().toISOString(),
  };
  await db.collection('tanks').insertOne(tank);
  res.json({ tank: withId(tank) }, 201);
});

router.get('/api/tanks/:tankId/calibration', requireAuth, async (req, res) => {
  const db = getDb();
  const tank = await db.collection('tanks').findOne({ _id: Number(req.params.tankId) });
  if (!tank) return res.error('Tank not found', 404);
  if (req.user.role !== 'owner' && req.user.site_id !== tank.site_id) return res.error('Forbidden', 403);
  const rows = [...(tank.calibration || [])].sort((a, b) => a.dip_mm - b.dip_mm);
  res.json({ tank: withId(tank), calibration: rows });
});

// Replaces the full calibration chart for a tank (bulk upsert).
router.put('/api/tanks/:tankId/calibration', requireAuth, requireOwner, async (req, res) => {
  const db = getDb();
  const tankId = Number(req.params.tankId);
  const tank = await db.collection('tanks').findOne({ _id: tankId });
  if (!tank) return res.error('Tank not found', 404);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length < 2) return res.error('At least two calibration points (dip_mm, liters) are required', 400);
  for (const r of rows) {
    if (typeof r.dip_mm !== 'number' || typeof r.liters !== 'number') {
      return res.error('Each row needs numeric dip_mm and liters', 400);
    }
  }
  const calibration = rows.map((r) => ({ dip_mm: r.dip_mm, liters: r.liters })).sort((a, b) => a.dip_mm - b.dip_mm);
  await db.collection('tanks').updateOne({ _id: tankId }, { $set: { calibration } });
  res.json({ ok: true, calibration });
});

router.put('/api/tanks/:tankId', requireAuth, requireOwner, async (req, res) => {
  const db = getDb();
  const tankId = Number(req.params.tankId);
  const tank = await db.collection('tanks').findOne({ _id: tankId });
  if (!tank) return res.error('Tank not found', 404);
  const name = req.body.name ?? tank.name;
  const capacity_liters = req.body.capacity_liters ?? tank.capacity_liters;
  await db.collection('tanks').updateOne({ _id: tankId }, { $set: { name, capacity_liters } });
  res.json({ tank: withId(await db.collection('tanks').findOne({ _id: tankId })) });
});

module.exports = router;
