const { MongoClient } = require('mongodb');

// Local MongoDB by default (matches "deploy it locally"). Override with a
// MONGODB_URI env var to point at MongoDB Atlas or any other instance
// instead, without touching any code.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'fuel_stock_manager';

let client = null;
let dbInstance = null;
let connecting = null;

async function connect() {
  if (dbInstance) return dbInstance;
  if (connecting) return connecting;
  connecting = (async () => {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
    } catch (err) {
      console.error('\nCould not connect to MongoDB.');
      console.error(`Tried: ${uri}`);
      console.error('Make sure MongoDB is installed and running - see README.md for setup steps.');
      console.error(`Original error: ${err.message}\n`);
      process.exit(1);
    }
    dbInstance = client.db(dbName);
    await ensureIndexes(dbInstance);
    return dbInstance;
  })();
  return connecting;
}

async function ensureIndexes(db) {
  await db.collection('sites').createIndex({ code: 1 }, { unique: true });
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  await db.collection('daily_entries').createIndex({ site_id: 1, entry_date: 1 }, { unique: true });
  await db.collection('tanks').createIndex({ site_id: 1 });
  await db.collection('nozzles').createIndex({ site_id: 1 });
  await db.collection('nozzles').createIndex({ tank_id: 1 });
  await db.collection('prices').createIndex({ site_id: 1, product_id: 1, effective_from: -1 });
}

function getDb() {
  if (!dbInstance) throw new Error('Database not connected yet');
  return dbInstance;
}

// Atomic auto-increment counter, the standard MongoDB pattern for getting
// simple sequential numeric ids (1, 2, 3, ...) instead of ObjectIds - keeps
// ids short and human-readable in URLs, logs, and the UI.
async function nextId(name) {
  const db = getDb();
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  // Some driver/server combinations return the doc directly, others wrap it
  // in `.value` - handle both.
  const doc = result && result.value !== undefined ? result.value : result;
  return doc.seq;
}

// Mongo documents use `_id` as the primary key; the rest of this app (and
// the frontend, unchanged from the SQLite version) expects a plain `id`
// field. This swaps `_id` -> `id` on the way out.
function withId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}
function withIds(docs) {
  return (docs || []).map(withId);
}

async function closeDb() {
  if (client) await client.close();
}

module.exports = { connect, getDb, nextId, withId, withIds, closeDb };
