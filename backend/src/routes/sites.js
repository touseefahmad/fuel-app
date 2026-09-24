const { Router } = require('../router');
const { getDb, withId, withIds } = require('../db');
const { requireAuth } = require('../middleware');

const router = new Router();

router.get('/api/sites', requireAuth, async (req, res) => {
  const db = getDb();
  const sites = req.user.role === 'owner'
    ? await db.collection('sites').find({}).sort({ _id: 1 }).toArray()
    : await db.collection('sites').find({ _id: req.user.site_id }).toArray();
  res.json({ sites: withIds(sites) });
});

router.get('/api/sites/:siteId', requireAuth, async (req, res) => {
  const siteId = Number(req.params.siteId);
  if (req.user.role !== 'owner' && req.user.site_id !== siteId) return res.error('Forbidden', 403);
  const db = getDb();
  const site = await db.collection('sites').findOne({ _id: siteId });
  if (!site) return res.error('Site not found', 404);
  res.json({ site: withId(site) });
});

router.get('/api/products', requireAuth, async (req, res) => {
  const db = getDb();
  const products = await db.collection('products').find({}).sort({ _id: 1 }).toArray();
  res.json({ products: withIds(products) });
});

module.exports = router;
