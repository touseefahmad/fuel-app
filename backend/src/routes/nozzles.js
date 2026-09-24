const { Router } = require('../router');
const { getDb, nextId, withId } = require('../db');
const { requireAuth, requireSiteAccess, requireOwner } = require('../middleware');

const router = new Router();

router.get('/api/sites/:siteId/nozzles', requireAuth, requireSiteAccess, async (req, res) => {
  const db = getDb();
  const nozzles = await db.collection('nozzles').find({ site_id: req.siteId, active: true }).toArray();
  const tanks = await db.collection('tanks').find({ site_id: req.siteId }).toArray();
  const products = await db.collection('products').find({}).toArray();
  const tankById = new Map(tanks.map((t) => [t._id, t]));
  const productById = new Map(products.map((p) => [p._id, p]));

  const enriched = nozzles
    .map((n) => {
      const tank = tankById.get(n.tank_id);
      const product = tank ? productById.get(tank.product_id) : null;
      return {
        ...withId(n),
        tank_name: tank?.name,
        product_id: tank?.product_id,
        product_name: product?.name,
        short_code: product?.short_code,
      };
    })
    .sort((a, b) => (a.product_id - b.product_id) || (a.tank_id - b.tank_id) || (a.id - b.id));

  res.json({ nozzles: enriched });
});

router.post('/api/sites/:siteId/nozzles', requireAuth, requireSiteAccess, requireOwner, async (req, res) => {
  const { tank_id, name } = req.body;
  if (!tank_id || !name) return res.error('tank_id and name are required', 400);
  const db = getDb();
  const tank = await db.collection('tanks').findOne({ _id: Number(tank_id), site_id: req.siteId });
  if (!tank) return res.error('Tank not found at this site', 404);
  const nozzleId = await nextId('nozzles');
  const nozzle = { _id: nozzleId, site_id: req.siteId, tank_id: Number(tank_id), name, active: true, created_at: new Date().toISOString() };
  await db.collection('nozzles').insertOne(nozzle);
  res.json({ nozzle: withId(nozzle) }, 201);
});

router.put('/api/nozzles/:id', requireAuth, requireOwner, async (req, res) => {
  const db = getDb();
  const nozzleId = Number(req.params.id);
  const nozzle = await db.collection('nozzles').findOne({ _id: nozzleId });
  if (!nozzle) return res.error('Nozzle not found', 404);
  const name = req.body.name ?? nozzle.name;
  const active = req.body.active !== undefined ? !!req.body.active : nozzle.active;
  await db.collection('nozzles').updateOne({ _id: nozzleId }, { $set: { name, active } });
  res.json({ nozzle: withId(await db.collection('nozzles').findOne({ _id: nozzleId })) });
});

module.exports = router;
