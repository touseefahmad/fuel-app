const { verifyToken } = require('./auth');
const { getDb } = require('./db');

async function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.error('Unauthorized - please log in again', 401);
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: payload.uid, active: true });
  if (!user) return res.error('Unauthorized - please log in again', 401);
  req.user = user;
  return next();
}

function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') return res.error('Owners only', 403);
  return next();
}

// Ensures the authenticated user may act on :siteId - owners may act on any
// site, managers only on their own assigned site.
function requireSiteAccess(req, res, next) {
  const siteId = Number(req.params.siteId || req.body.site_id || req.query.site_id);
  if (!siteId) return res.error('site_id is required', 400);
  if (req.user.role === 'owner') { req.siteId = siteId; return next(); }
  if (req.user.site_id === siteId) { req.siteId = siteId; return next(); }
  return res.error('You do not have access to this site', 403);
}

module.exports = { requireAuth, requireOwner, requireSiteAccess };
