const { Router } = require('../router');
const { all, get, run } = require('../db');
const { requireAuth, requireOwner } = require('../middleware');
const { hashPassword } = require('../auth');

const router = new Router();

function publicUser(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role, site_id: u.site_id, active: !!u.active };
}

router.get('/api/users', requireAuth, requireOwner, (req, res) => {
  const users = all('SELECT * FROM users ORDER BY role, username').map(publicUser);
  res.json({ users });
});

router.post('/api/users', requireAuth, requireOwner, (req, res) => {
  const { username, full_name, password, role, site_id } = req.body;
  if (!username || !full_name || !password || !role) return res.error('username, full_name, password and role are required', 400);
  if (!['owner', 'manager'].includes(role)) return res.error('role must be owner or manager', 400);
  if (role === 'manager' && !site_id) return res.error('Managers must be assigned a site', 400);
  const uname = String(username).trim().toLowerCase();
  if (get('SELECT id FROM users WHERE username = ?', [uname])) return res.error('Username already exists', 409);
  const result = run(
    'INSERT INTO users (username, full_name, password_hash, role, site_id) VALUES (?,?,?,?,?)',
    [uname, full_name, hashPassword(password), role, role === 'manager' ? site_id : null]
  );
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [Number(result.lastInsertRowid)])) }, 201);
});

router.put('/api/users/:id', requireAuth, requireOwner, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.error('User not found', 404);
  const full_name = req.body.full_name ?? user.full_name;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : user.active;
  const site_id = req.body.site_id !== undefined ? req.body.site_id : user.site_id;
  run('UPDATE users SET full_name = ?, active = ?, site_id = ? WHERE id = ?', [full_name, active, site_id, req.params.id]);
  if (req.body.password) {
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(req.body.password), req.params.id]);
  }
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [req.params.id])) });
});

module.exports = router;
