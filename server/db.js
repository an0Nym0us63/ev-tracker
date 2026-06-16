const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'ev-tracker.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    vehicle_id    TEXT NOT NULL DEFAULT 'mg4',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    ocm_api_key TEXT,
    home_lat    REAL,
    home_lng    REAL,
    home_label  TEXT
  );

  CREATE TABLE IF NOT EXISTS charges (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    vehicle_id           TEXT NOT NULL,
    location_id          TEXT NOT NULL,
    location_name        TEXT,
    provider             TEXT,
    card                 TEXT,
    date                 TEXT NOT NULL,
    kwh                  REAL NOT NULL,
    total_cost           REAL NOT NULL,
    duration_min         INTEGER,
    odometer             INTEGER,
    notes                TEXT,
    source               TEXT NOT NULL DEFAULT 'manual',
    lat                  REAL,
    lng                  REAL,
    location_approximate INTEGER NOT NULL DEFAULT 0,
    ocm_id               TEXT,
    power_kw             REAL,
    connector_types      TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    value      TEXT NOT NULL,
    UNIQUE(account_id, type, value)
  );
`)

// Migrations — add columns if they don't exist yet (idempotent)
const chargeColumns = db.pragma('table_info(charges)').map(c => c.name)
if (!chargeColumns.includes('lat'))                  db.exec('ALTER TABLE charges ADD COLUMN lat REAL')
if (!chargeColumns.includes('lng'))                  db.exec('ALTER TABLE charges ADD COLUMN lng REAL')
if (!chargeColumns.includes('location_approximate')) db.exec('ALTER TABLE charges ADD COLUMN location_approximate INTEGER NOT NULL DEFAULT 0')
if (!chargeColumns.includes('ocm_id'))               db.exec('ALTER TABLE charges ADD COLUMN ocm_id TEXT')
if (!chargeColumns.includes('power_kw'))             db.exec('ALTER TABLE charges ADD COLUMN power_kw REAL')
if (!chargeColumns.includes('connector_types'))      db.exec('ALTER TABLE charges ADD COLUMN connector_types TEXT')

// Favorite locations table
db.exec(`
  CREATE TABLE IF NOT EXISTS favorite_locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    provider    TEXT,
    location_id TEXT NOT NULL DEFAULT 'ext',
    lat         REAL,
    lng         REAL,
    ocm_id      TEXT,
    operator    TEXT,
    power_kw    REAL,
    connector_types TEXT,
    use_count   INTEGER NOT NULL DEFAULT 1,
    last_used   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(account_id, label)
  )
`)

// Migration: add fuel_savings column
try {
  db.exec('ALTER TABLE charges ADD COLUMN fuel_savings REAL')
} catch(e) {} // already exists

// Migration: add fuel_price setting
try {
  db.exec('ALTER TABLE settings ADD COLUMN fuel_price REAL NOT NULL DEFAULT 1.85')
} catch(e) {}

// Vehicle consumption references (kWh/100km consumed, L/100km thermal, fuel type)
const VEHICLE_REF = {
  mg4:   { kwhPer100: 14.5, thermalL100: 6.0 },
  xpeng: { kwhPer100: 16.0, thermalL100: 7.5 },
}

function calcSavings(vehicleId, kwh, totalCost, fuelPrice) {
  const ref = VEHICLE_REF[vehicleId]
  if (!ref || !kwh) return null
  const km = kwh / ref.kwhPer100 * 100
  const thermalCost = km * ref.thermalL100 / 100 * fuelPrice
  return parseFloat((thermalCost - totalCost).toFixed(2))
}
global.calcSavings = calcSavings
global.VEHICLE_REF = VEHICLE_REF

// Migration: backfill fuel_savings for existing charges using default price 1.85
const chargesToFill = db.prepare("SELECT id, vehicle_id, kwh, total_cost FROM charges WHERE fuel_savings IS NULL").all()
const updateSavings = db.prepare("UPDATE charges SET fuel_savings = ? WHERE id = ?")
const fillTx = db.transaction(() => {
  for (const c of chargesToFill) {
    const s = calcSavings(c.vehicle_id, c.kwh, c.total_cost, 1.85)
    if (s !== null) updateSavings.run(s, c.id)
  }
})
try { fillTx(); console.log(`[db] backfilled savings for ${chargesToFill.length} charges`) } catch(e) { console.error('[db] savings backfill error:', e.message) }

// Migration: seed favorite_locations from existing external charges
const seedFavs = db.prepare(`
  INSERT OR IGNORE INTO favorite_locations (account_id, label, provider, location_id, lat, lng, ocm_id, operator, power_kw, connector_types, use_count, last_used)
  SELECT
    account_id,
    COALESCE(location_name, provider, 'Borne externe') as label,
    provider,
    location_id,
    lat, lng, ocm_id,
    provider as operator,
    power_kw, connector_types,
    COUNT(*) as use_count,
    MAX(date) as last_used
  FROM charges
  WHERE location_id != 'home'
    AND COALESCE(location_name, provider) IS NOT NULL
    AND COALESCE(location_name, provider) != ''
  GROUP BY account_id, COALESCE(location_name, provider)
`)
seedFavs.run()

module.exports = db

// ─── V2C Settings migrations ──────────────────────────────────────────────────
const settingsCols = db.pragma('table_info(settings)').map(c => c.name)
if (!settingsCols.includes('v2c_enabled'))    db.exec("ALTER TABLE settings ADD COLUMN v2c_enabled INTEGER NOT NULL DEFAULT 0")
if (!settingsCols.includes('v2c_api_key'))    db.exec("ALTER TABLE settings ADD COLUMN v2c_api_key TEXT")
if (!settingsCols.includes('v2c_device_id'))  db.exec("ALTER TABLE settings ADD COLUMN v2c_device_id TEXT")
if (!settingsCols.includes('v2c_last_id'))    db.exec("ALTER TABLE settings ADD COLUMN v2c_last_id INTEGER")

// ─── Charges migrations ───────────────────────────────────────────────────────
const chargeCols2 = db.pragma('table_info(charges)').map(c => c.name)
if (!chargeCols2.includes('v2c_id'))        db.exec("ALTER TABLE charges ADD COLUMN v2c_id INTEGER")
if (!chargeCols2.includes('start_time'))    db.exec("ALTER TABLE charges ADD COLUMN start_time TEXT")
if (!chargeCols2.includes('solar_savings')) db.exec("ALTER TABLE charges ADD COLUMN solar_savings REAL")
if (!chargeCols2.includes('needs_review'))  db.exec("ALTER TABLE charges ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0")

// ─── Sync log table ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    level      TEXT NOT NULL DEFAULT 'info',
    source     TEXT NOT NULL DEFAULT 'system',
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sync_log_account ON sync_log(account_id, created_at DESC);
`)

// ─── Cleanup V2C Trydan → V2C ─────────────────────────────────────────────────
try {
  db.exec("UPDATE charges SET provider='V2C' WHERE provider='V2C Trydan'")
  db.exec("UPDATE charges SET card='V2C' WHERE card='V2C Trydan'")
  db.exec("UPDATE lists SET value='V2C' WHERE type='providers' AND value='V2C Trydan'")
  db.exec("UPDATE lists SET value='V2C' WHERE type='cards' AND value='V2C Trydan'")
} catch(e) {}
