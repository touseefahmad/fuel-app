const { Router } = require('../router');
const { getDb } = require('../db');
const { verifyPassword, signToken, hashPassword } = require('../auth');
const { requireAuth } = require('../middleware');

const router = new Router();

function publicUser(u) {
  return { id: u._id, username: u.username, full_name: u.full_name, role: u.role, site_id: u.site_id };
}

router.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.error('Username and password are required', 400);
  const db = getDb();
  const user = await db.collection('users').findOne({ username: String(username).trim().toLowerCase(), active: true });
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.error('Invalid username or password', 401);
  }
  const token = signToken({ uid: user._id, role: user.role });
  res.json({ token, user: publicUser(user) });
});

router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || String(new_password).length < 4) {
    return res.error('New password must be at least 4 characters', 400);
  }
  if (!verifyPassword(current_password || '', req.user.password_hash)) {
    return res.error('Current password is incorrect', 401);
  }
  const db = getDb();
  await db.collection('users').updateOne({ _id: req.user._id }, { $set: { password_hash: hashPassword(new_password) } });
  res.json({ ok: true });
});

module.exports = router;
