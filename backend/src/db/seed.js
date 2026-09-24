const { getDb, nextId } = require('./index');
const { hashPassword } = require('../auth');
const { generatePlaceholderCalibration } = require('../utils/calibration');
const { today } = require('../utils/date');

async function seedIfEmpty() {
  const db = getDb();
  const siteCount = await db.collection('sites').countDocuments();
  if (siteCount > 0) return { seeded: false };

  console.log('First run detected - seeding starter data (sites, products, users, tanks, nozzles, sample prices)...');

  const sites = db.collection('sites');
  const products = db.collection('products');
  const users = db.collection('users');
  const tanks = db.collection('tanks');
  const nozzles = db.collection('nozzles');
  const prices = db.collection('prices');

  const now = new Date().toISOString();

  const mtfId = await nextId('sites');
  await sites.insertOne({ _id: mtfId, name: 'Mirza Tahir Filling Station', brand: 'Shell', code: 'MTF-SHELL', address: '', created_at: now });
  const ffsId = await nextId('sites');
  await sites.insertOne({ _id: ffsId, name: 'Fast Filling Station', brand: 'Puma', code: 'FFS-PUMA', address: '', created_at: now });

  const petrolId = await nextId('products');
  await products.insertOne({ _id: petrolId, name: 'Petrol', short_code: 'MS', unit: 'Litre' });
  const hsdId = await nextId('products');
  await products.insertOne({ _id: hsdId, name: 'High Speed Diesel', short_code: 'HSD', unit: 'Litre' });

  const siteIds = [mtfId, ffsId];
  const productIds = [petrolId, hsdId];

  for (const siteId of siteIds) {
    for (const productId of productIds) {
      const capacity = 12000;
      const tankId = await nextId('tanks');
      const calibration = generatePlaceholderCalibration(capacity);
      await tanks.insertOne({
        _id: tankId,
        site_id: siteId,
        product_id: productId,
        name: `${productId === petrolId ? 'MS' : 'HSD'} Tank 1`,
        capacity_liters: capacity,
        dip_unit: 'mm',
        active: true,
        calibration,
        created_at: now,
      });

      const noz1Id = await nextId('nozzles');
      await nozzles.insertOne({ _id: noz1Id, site_id: siteId, tank_id: tankId, name: `${productId === petrolId ? 'MS' : 'HSD'} Nozzle 1`, active: true, created_at: now });
      const noz2Id = await nextId('nozzles');
      await nozzles.insertOne({ _id: noz2Id, site_id: siteId, tank_id: tankId, name: `${productId === petrolId ? 'MS' : 'HSD'} Nozzle 2`, active: true, created_at: now });
    }

    // Sample starting prices (PKR/liter) - placeholders, update via the Prices screen to the current notified rate.
    const seedDate = today();
    const priceMsId = await nextId('prices');
    await prices.insertOne({ _id: priceMsId, site_id: siteId, product_id: petrolId, price_per_liter: 275.0, effective_from: seedDate, created_at: now });
    const priceHsdId = await nextId('prices');
    await prices.insertOne({ _id: priceHsdId, site_id: siteId, product_id: hsdId, price_per_liter: 285.0, effective_from: seedDate, created_at: now });
  }

  const ownerId = await nextId('users');
  await users.insertOne({ _id: ownerId, username: 'owner', full_name: 'Owner / Admin', password_hash: hashPassword('owner123'), role: 'owner', site_id: null, active: true, created_at: now });
  const mtfManagerId = await nextId('users');
  await users.insertOne({ _id: mtfManagerId, username: 'mtf_manager', full_name: 'Mirza Tahir - Site Manager', password_hash: hashPassword('shell123'), role: 'manager', site_id: mtfId, active: true, created_at: now });
  const ffsManagerId = await nextId('users');
  await users.insertOne({ _id: ffsManagerId, username: 'ffs_manager', full_name: 'Fast Filling - Site Manager', password_hash: hashPassword('puma123'), role: 'manager', site_id: ffsId, active: true, created_at: now });

  console.log('Seed complete. Default logins:');
  console.log('  Owner:            username "owner"        password "owner123"');
  console.log('  Mirza Tahir (Shell) manager: username "mtf_manager"  password "shell123"');
  console.log('  Fast Filling (Puma) manager: username "ffs_manager"  password "puma123"');
  console.log('IMPORTANT: change these passwords after first login, and replace the placeholder');
  console.log('tank calibration charts and prices with your real dip-chart and OGRA/company rates.');

  return { seeded: true };
}

module.exports = { seedIfEmpty };
