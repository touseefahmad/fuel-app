const { all, get } = require('../db');

// Returns the price per liter in effect for a product at a site on a given
// date (the latest price row with effective_from <= date).
function priceOnDate(siteId, productId, date) {
  const row = get(
    `SELECT price_per_liter FROM prices
     WHERE site_id = ? AND product_id = ? AND effective_from <= ?
     ORDER BY effective_from DESC, id DESC LIMIT 1`,
    [siteId, productId, date]
  );
  return row ? row.price_per_liter : null;
}

// Builds the per-product (Petrol / HSD) summary for one site+date daily
// entry: opening/closing stock, receipts, meter-based sales, the dip-based
// actual closing stock, and the loss/gain (variance) between them, all
// priced at that date's rate.
function buildDailySummary(siteId, entryDate, dailyEntryId) {
  const products = all('SELECT * FROM products ORDER BY id');
  const tankRows = dailyEntryId
    ? all(
        `SELECT tr.*, t.product_id, t.name as tank_name, t.capacity_liters
         FROM tank_readings tr JOIN tanks t ON t.id = tr.tank_id
         WHERE tr.daily_entry_id = ?`,
        [dailyEntryId]
      )
    : [];
  const nozzleRows = dailyEntryId
    ? all(
        `SELECT nr.*, t.product_id
         FROM nozzle_readings nr
         JOIN nozzles n ON n.id = nr.nozzle_id
         JOIN tanks t ON t.id = n.tank_id
         WHERE nr.daily_entry_id = ?`,
        [dailyEntryId]
      )
    : [];

  const perProduct = products.map((product) => {
    const tanks = tankRows.filter((t) => t.product_id === product.id);
    const nozzles = nozzleRows.filter((n) => n.product_id === product.id);

    const opening_stock_liters = sum(tanks.map((t) => t.opening_stock_liters));
    const receipts_liters = sum(tanks.map((t) => t.receipt_liters));
    const meter_sales_liters = sum(nozzles.map((n) => n.liters_sold));
    const actual_closing_liters = sum(tanks.map((t) => t.closing_stock_liters));
    const expected_closing_liters = opening_stock_liters + receipts_liters - meter_sales_liters;
    const variance_liters = tanks.length ? actual_closing_liters - expected_closing_liters : 0;

    const price_per_liter = priceOnDate(siteId, product.id, entryDate);
    const sales_amount = price_per_liter != null ? round2(meter_sales_liters * price_per_liter) : null;
    const variance_amount = price_per_liter != null ? round2(variance_liters * price_per_liter) : null;
    const closing_stock_value = price_per_liter != null ? round2(actual_closing_liters * price_per_liter) : null;

    return {
      product_id: product.id,
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
      tank_count: tanks.length,
      nozzle_count: nozzles.length,
    };
  });

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
