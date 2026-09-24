const { Router } = require('../router');
const { getDb, nextId, withId, withIds } = require('../db');
const { requireAuth, requireOwner } = require('../middleware');
const { hashPassword } = require('../auth');

const router = new Router();

function publicUser(u) {
  return { id: u._id, username: u.username, full_name: u.full_name, role: u.role, site_id: u.site_id, active: !!u.active };
}

router.get('/api/users', requireAuth, requireOwner, async (req, res) => {
  const db = getDb();
  const users = await db.collection('users').find({}).sort({ role: 1, username: 1 }).toArray();
  res.json({ users: users.map(publicUser) });
});

router.post('/api/users', requireAuth, requireOwner, async (req, res) => {
  const { username, full_name, password, role, site_id } = req.body;
  if (!username || !full_name || !password || !role) return res.error('username, full_name, password and role are required', 400);
  if (!['owner', 'manager'].includes(role)) return res.error('role must be owner or manager', 400);
  if (role === 'manager' && !site_id) return res.error('Managers must be assigned a site', 400);
  const db = getDb();
  const uname = String(username).trim().toLowerCase();
  if (await db.collection('users').findOne({ username: uname })) return res.error('Username already exists', 409);
  const userId = await nextId('users');
  const user = {
    _id: userId,
    username: uname,
    full_name,
    password_hash: hashPassword(password),
    role,
    site_id: role === 'manager' ? Number(site_id) : null,
    active: true,
    created_at: new Date().toISOString(),
  };
  await db.collection('users').insertOne(user);
  res.json({ user: publicUser(user) }, 201);
});

router.put('/api/users/:id', requireAuth, requireOwner, async (req, res) => {
  const db = getDb();
  const userId = Number(req.params.id);
  const user = await db.collection('users').findOne({ _id: userId });
  if (!user) return res.error('User not found', 404);
  const full_name = req.body.full_name ?? user.full_name;
  const active = req.body.active !== undefined ? !!req.body.active : user.active;
  const site_id = req.body.site_id !== undefined ? req.body.site_id : user.site_id;
  const update = { full_name, active, site_id };
  if (req.body.password) update.password_hash = hashPassword(req.body.password);
  await db.collection('users').updateOne({ _id: userId }, { $set: update });
  res.json({ user: publicUser(await db.collection('users').findOne({ _id: userId })) });
});

module.exports = router;
