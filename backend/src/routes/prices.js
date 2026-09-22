const { Router } = require('../router');
const { all, get, run } = require('../db');
const { requireAuth, requireSiteAccess, requireOwner } = require('../middleware');
const { priceOnDate } = require('../utils/summary');
const { today } = require('../utils/date');

const router = new Router();

router.get('/api/sites/:siteId/prices', requireAuth, requireSiteAccess, (req, res) => {
  const rows = all(
    `SELECT pr.*, p.name as product_name, p.short_code
     FROM prices pr JOIN products p ON p.id = pr.product_id
     WHERE pr.site_id = ? ORDER BY pr.effective_from DESC, pr.id DESC`,
    [req.siteId]
  );
  const products = all('SELECT * FROM products ORDER BY id');
  const asOf = today();
  const current = products.map((p) => ({
    product_id: p.id,
    product_name: p.name,
    price_per_liter: priceOnDate(req.siteId, p.id, asOf),
  }));
  res.json({ prices: rows, current });
});

router.post('/api/sites/:siteId/prices', requireAuth, requireSiteAccess, requireOwner, (req, res) => {
  const { product_id, price_per_liter, effective_from } = req.body;
  if (!product_id || price_per_liter === undefined || !effective_from) {
    return res.error('product_id, price_per_liter and effective_from are required', 400);
  }
  if (Number(price_per_liter) <= 0) return res.error('price_per_liter must be greater than 0', 400);
  const result = run(
    'INSERT INTO prices (site_id, product_id, price_per_liter, effective_from, created_by) VALUES (?,?,?,?,?)',
    [req.siteId, product_id, price_per_liter, effective_from, req.user.id]
  );
  res.json({ price: get('SELECT * FROM prices WHERE id = ?', [Number(result.lastInsertRowid)]) }, 201);
});

router.delete('/api/prices/:id', requireAuth, requireOwner, (req, res) => {
  run('DELETE FROM prices WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
