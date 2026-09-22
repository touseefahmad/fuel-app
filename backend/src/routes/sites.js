const { Router } = require('../router');
const { all, get } = require('../db');
const { requireAuth } = require('../middleware');

const router = new Router();

router.get('/api/sites', requireAuth, (req, res) => {
  const sites = req.user.role === 'owner'
    ? all('SELECT * FROM sites ORDER BY id')
    : all('SELECT * FROM sites WHERE id = ?', [req.user.site_id]);
  res.json({ sites });
});

router.get('/api/sites/:siteId', requireAuth, (req, res) => {
  const siteId = Number(req.params.siteId);
  if (req.user.role !== 'owner' && req.user.site_id !== siteId) return res.error('Forbidden', 403);
  const site = get('SELECT * FROM sites WHERE id = ?', [siteId]);
  if (!site) return res.error('Site not found', 404);
  res.json({ site });
});

router.get('/api/products', requireAuth, (req, res) => {
  res.json({ products: all('SELECT * FROM products ORDER BY id') });
});

module.exports = router;
