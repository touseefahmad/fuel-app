-- Fuel Stock Manager schema
-- SQLite (via Node's built-in node:sqlite module)

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,       -- 'Petrol' | 'HSD'
  short_code TEXT NOT NULL UNIQUE, -- 'MS' | 'HSD'
  unit TEXT NOT NULL DEFAULT 'Litre'
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager')),
  site_id INTEGER REFERENCES sites(id), -- NULL for owner (sees all sites); required for manager
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tanks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,              -- e.g. 'Tank 1'
  capacity_liters REAL NOT NULL,
  dip_unit TEXT NOT NULL DEFAULT 'mm', -- unit used for dip readings
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dip-to-liters calibration chart (per tank). Values are looked up / interpolated.
CREATE TABLE IF NOT EXISTS tank_calibration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tank_id INTEGER NOT NULL REFERENCES tanks(id),
  dip_mm REAL NOT NULL,
  liters REAL NOT NULL,
  UNIQUE(tank_id, dip_mm)
);

CREATE TABLE IF NOT EXISTS nozzles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  tank_id INTEGER NOT NULL REFERENCES tanks(id),
  name TEXT NOT NULL,               -- e.g. 'Nozzle 1' / 'MS Dispenser A'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price history per site + product. The price effective on a date is the
-- latest row with effective_from <= that date.
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  price_per_liter REAL NOT NULL,
  effective_from TEXT NOT NULL,     -- date 'YYYY-MM-DD'
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per site per calendar date.
CREATE TABLE IF NOT EXISTS daily_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  entry_date TEXT NOT NULL,         -- 'YYYY-MM-DD'
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, entry_date)
);

CREATE TABLE IF NOT EXISTS tank_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_entry_id INTEGER NOT NULL REFERENCES daily_entries(id),
  tank_id INTEGER NOT NULL REFERENCES tanks(id),
  opening_dip_mm REAL,
  closing_dip_mm REAL,
  opening_stock_liters REAL,   -- derived from opening_dip_mm via calibration
  closing_stock_liters REAL,   -- derived from closing_dip_mm via calibration (actual physical stock)
  receipt_liters REAL NOT NULL DEFAULT 0,  -- delivery received into tank that day
  receipt_invoice_no TEXT,
  UNIQUE(daily_entry_id, tank_id)
);

CREATE TABLE IF NOT EXISTS nozzle_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_entry_id INTEGER NOT NULL REFERENCES daily_entries(id),
  nozzle_id INTEGER NOT NULL REFERENCES nozzles(id),
  opening_meter REAL,
  closing_meter REAL,
  test_liters REAL NOT NULL DEFAULT 0,  -- liters drawn for testing/calibration, excluded from sales
  liters_sold REAL,                     -- derived: closing - opening - test
  UNIQUE(daily_entry_id, nozzle_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_site_date ON daily_entries(site_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_tank_readings_entry ON tank_readings(daily_entry_id);
CREATE INDEX IF NOT EXISTS idx_nozzle_readings_entry ON nozzle_readings(daily_entry_id);
CREATE INDEX IF NOT EXISTS idx_prices_site_product ON prices(site_id, product_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_calibration_tank ON tank_calibration(tank_id, dip_mm);
