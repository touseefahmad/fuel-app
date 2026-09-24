const { Router } = require('../router');
const { getDb, nextId, withId, withIds } = require('../db');
const { requireAuth, requireSiteAccess, requireOwner } = require('../middleware');
const { priceOnDate } = require('../utils/summary');
const { today } = require('../utils/date');

const router = new Router();

router.get('/api/sites/:siteId/prices', requireAuth, requireSiteAccess, async (req, res) => {
  const db = getDb();
  const rows = await db.collection('prices').find({ site_id: req.siteId }).sort({ effective_from: -1, _id: -1 }).toArray();
  const products = await db.collection('products').find({}).sort({ _id: 1 }).toArray();
  const productById = new Map(products.map((p) => [p._id, p]));
  const enriched = rows.map((r) => ({ ...withId(r), product_name: productById.get(r.product_id)?.name, short_code: productById.get(r.product_id)?.short_code }));

  const asOf = today();
  const current = [];
  for (const p of products) {
    current.push({ product_id: p._id, product_name: p.name, price_per_liter: await priceOnDate(req.siteId, p._id, asOf) });
  }
  res.json({ prices: enriched, current });
});

router.post('/api/sites/:siteId/prices', requireAuth, requireSiteAccess, requireOwner, async (req, res) => {
  const { product_id, price_per_liter, effective_from } = req.body;
  if (!product_id || price_per_liter === undefined || !effective_from) {
    return res.error('product_id, price_per_liter and effective_from are required', 400);
  }
  if (Number(price_per_liter) <= 0) return res.error('price_per_liter must be greater than 0', 400);
  const db = getDb();
  const priceId = await nextId('prices');
  const price = {
    _id: priceId,
    site_id: req.siteId,
    product_id: Number(product_id),
    price_per_liter: Number(price_per_liter),
    effective_from,
    created_by: req.user._id,
    created_at: new Date().toISOString(),
  };
  await db.collection('prices').insertOne(price);
  res.json({ price: withId(price) }, 201);
});

router.delete('/api/prices/:id', requireAuth, requireOwner, async (req, res) => {
  const db = getDb();
  await db.collection('prices').deleteOne({ _id: Number(req.params.id) });
  res.json({ ok: true });
});

module.exports = router;
