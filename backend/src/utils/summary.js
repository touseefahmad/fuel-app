const { getDb } = require('../db');

// Returns the price per liter in effect for a product at a site on a given
// date (the latest price row with effective_from <= date).
async function priceOnDate(siteId, productId, date) {
  const db = getDb();
  const row = await db.collection('prices')
    .find({ site_id: siteId, product_id: productId, effective_from: { $lte: date } })
    .sort({ effective_from: -1, _id: -1 })
    .limit(1)
    .next();
  return row ? row.price_per_liter : null;
}

// Builds the per-product (Petrol / HSD) summary for one site+date: opening/
// closing stock, receipts, meter-based sales, the dip-based actual closing
// stock, and the loss/gain (variance) between them, all priced at that
// date's rate. `entry` is the daily_entries document for that site+date (or
// null if nothing has been saved yet) - tank_readings/nozzle_readings live
// embedded inside it.
async function buildDailySummary(siteId, entryDate, entry) {
  const db = getDb();
  const products = await db.collection('products').find({}).sort({ _id: 1 }).toArray();
  const tanks = await db.collection('tanks').find({ site_id: siteId, active: true }).toArray();
  const nozzles = await db.collection('nozzles').find({ site_id: siteId, active: true }).toArray();

  const tankById = new Map(tanks.map((t) => [t._id, t]));
  const tankReadings = entry?.tank_readings || [];
  const nozzleReadings = entry?.nozzle_readings || [];

  const perProduct = [];
  for (const product of products) {
    const productTanks = tanks.filter((t) => t.product_id === product._id);
    const productTankIds = new Set(productTanks.map((t) => t._id));
    const productNozzles = nozzles.filter((n) => {
      const tank = tankById.get(n.tank_id);
      return tank && tank.product_id === product._id;
    });
    const productNozzleIds = new Set(productNozzles.map((n) => n._id));

    const tReadings = tankReadings.filter((tr) => productTankIds.has(tr.tank_id));
    const nReadings = nozzleReadings.filter((nr) => productNozzleIds.has(nr.nozzle_id));

    const opening_stock_liters = sum(tReadings.map((t) => t.opening_stock_liters));
    const receipts_liters = sum(tReadings.map((t) => t.receipt_liters));
    const meter_sales_liters = sum(nReadings.map((n) => n.liters_sold));
    const actual_closing_liters = sum(tReadings.map((t) => t.closing_stock_liters));
    const expected_closing_liters = opening_stock_liters + receipts_liters - meter_sales_liters;
    const variance_liters = tReadings.length ? actual_closing_liters - expected_closing_liters : 0;

    const price_per_liter = await priceOnDate(siteId, product._id, entryDate);
    const sales_amount = price_per_liter != null ? round2(meter_sales_liters * price_per_liter) : null;
    const variance_amount = price_per_liter != null ? round2(variance_liters * price_per_liter) : null;
    const closing_stock_value = price_per_liter != null ? round2(actual_closing_liters * price_per_liter) : null;

    perProduct.push({
      product_id: product._id,
      product_name: product.name,
      short_code: product.short_code,
      price_per_liter,
      opening_stock_liters: round2(opening_stock_liters),
      receipts_liters: round2(receipts_liters),
      meter_sales_liters: round2(meter_sales_liters),
      expected_closing_liters: round2(expected_closing_liters),
      actual_closing_liters: round2(actual_closing_liters),
      variance_liters: round2(variance_liters),
      variance_type: variance_liters < -0.001 ? 'loss' : variance_liters > 0.001 ? 'gain' : 'none',
      sales_amount,
      variance_amount,
      closing_stock_value,
      tank_count: productTanks.length,
      nozzle_count: productNozzles.length,
    });
  }

  const totals = {
    meter_sales_amount: round2(sum(perProduct.map((p) => p.sales_amount))),
    variance_amount: round2(sum(perProduct.map((p) => p.variance_amount))),
    variance_liters: round2(sum(perProduct.map((p) => p.variance_liters))),
    closing_stock_value: round2(sum(perProduct.map((p) => p.closing_stock_value))),
    meter_sales_liters: round2(sum(perProduct.map((p) => p.meter_sales_liters))),
  };

  return { products: perProduct, totals };
}

function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}
function round2(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return n === null ? null : 0;
  return Math.round(n * 100) / 100;
}

module.exports = { buildDailySummary, priceOnDate, round2 };
