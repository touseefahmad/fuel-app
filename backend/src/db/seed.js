const { get, run, all } = require('./index');
const { hashPassword } = require('../auth');
const { generatePlaceholderCalibration } = require('../utils/calibration');
const { today } = require('../utils/date');

function seedIfEmpty() {
  const siteCount = get('SELECT COUNT(*) as c FROM sites').c;
  if (siteCount > 0) return { seeded: false };

  console.log('First run detected - seeding starter data (sites, products, users, tanks, nozzles, sample prices)...');

  // --- Sites ---
  const mtf = run(
    "INSERT INTO sites (name, brand, code, address) VALUES (?,?,?,?)",
    ['Mirza Tahir Filling Station', 'Shell', 'MTF-SHELL', '']
  ).lastInsertRowid;
  const ffs = run(
    "INSERT INTO sites (name, brand, code, address) VALUES (?,?,?,?)",
    ['Fast Filling Station', 'Puma', 'FFS-PUMA', '']
  ).lastInsertRowid;

  // --- Products ---
  const petrol = run("INSERT INTO products (name, short_code, unit) VALUES (?,?,?)", ['Petrol', 'MS', 'Litre']).lastInsertRowid;
  const hsd = run("INSERT INTO products (name, short_code, unit) VALUES (?,?,?)", ['High Speed Diesel', 'HSD', 'Litre']).lastInsertRowid;

  const sites = [Number(mtf), Number(ffs)];
  const products = [Number(petrol), Number(hsd)];

  for (const siteId of sites) {
    for (const productId of products) {
      const capacity = 12000;
      const tankId = Number(run(
        'INSERT INTO tanks (site_id, product_id, name, capacity_liters) VALUES (?,?,?,?)',
        [siteId, productId, `${productId === petrol ? 'MS' : 'HSD'} Tank 1`, capacity]
      ).lastInsertRowid);

      const calibration = generatePlaceholderCalibration(capacity);
      for (const row of calibration) {
        run('INSERT INTO tank_calibration (tank_id, dip_mm, liters) VALUES (?,?,?)', [tankId, row.dip_mm, row.liters]);
      }

      run('INSERT INTO nozzles (site_id, tank_id, name) VALUES (?,?,?)', [siteId, tankId, `${productId === petrol ? 'MS' : 'HSD'} Nozzle 1`]);
      run('INSERT INTO nozzles (site_id, tank_id, name) VALUES (?,?,?)', [siteId, tankId, `${productId === petrol ? 'MS' : 'HSD'} Nozzle 2`]);
    }

    // Sample starting prices (PKR/liter) - placeholders, update via the Prices screen to the current notified rate.
    const seedDate = today();
    run('INSERT INTO prices (site_id, product_id, price_per_liter, effective_from) VALUES (?,?,?,?)', [siteId, petrol, 275.00, seedDate]);
    run('INSERT INTO prices (site_id, product_id, price_per_liter, effective_from) VALUES (?,?,?,?)', [siteId, hsd, 285.00, seedDate]);
  }

  // --- Users ---
  run('INSERT INTO users (username, full_name, password_hash, role, site_id) VALUES (?,?,?,?,?)',
    ['owner', 'Owner / Admin', hashPassword('owner123'), 'owner', null]);
  run('INSERT INTO users (username, full_name, password_hash, role, site_id) VALUES (?,?,?,?,?)',
    ['mtf_manager', 'Mirza Tahir - Site Manager', hashPassword('shell123'), 'manager', mtf]);
  run('INSERT INTO users (username, full_name, password_hash, role, site_id) VALUES (?,?,?,?,?)',
    ['ffs_manager', 'Fast Filling - Site Manager', hashPassword('puma123'), 'manager', ffs]);

  console.log('Seed complete. Default logins:');
  console.log('  Owner:            username "owner"        password "owner123"');
  console.log('  Mirza Tahir (Shell) manager: username "mtf_manager"  password "shell123"');
  console.log('  Fast Filling (Puma) manager: username "ffs_manager"  password "puma123"');
  console.log('IMPORTANT: change these passwords after first login, and replace the placeholder');
  console.log('tank calibration charts and prices with your real dip-chart and OGRA/company rates.');

  return { seeded: true };
}

module.exports = { seedIfEmpty };
