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

module.exports = db
