const { Router } = require('../router');
const { get, run } = require('../db');
const { verifyPassword, signToken, hashPassword } = require('../auth');
const { requireAuth } = require('../middleware');

const router = new Router();

function publicUser(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role, site_id: u.site_id };
}

router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.error('Username and password are required', 400);
  const user = get('SELECT * FROM users WHERE username = ? AND active = 1', [String(username).trim().toLowerCase()]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.error('Invalid username or password', 401);
  }
  const token = signToken({ uid: user.id, role: user.role });
  res.json({ token, user: publicUser(user) });
});

router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || String(new_password).length < 4) {
    return res.error('New password must be at least 4 characters', 400);
  }
  if (!verifyPassword(current_password || '', req.user.password_hash)) {
    return res.error('Current password is incorrect', 401);
  }
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(new_password), req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
