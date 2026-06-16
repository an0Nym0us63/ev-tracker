const https = require('https')
const db    = require('./db')

// ─── Helper: addLog ────────────────────────────────────────────────────────────
function addLog(accountId, level, message, source = 'v2c') {
  try {
    db.prepare('INSERT INTO sync_log (account_id, level, source, message) VALUES (?,?,?,?)').run(accountId, level, source, message)
  } catch(e) { console.error('[log]', e.message) }
}

// ─── Helper: fetch V2C API ────────────────────────────────────────────────────
function v2cFetch(path, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://v2c.cloud/kong/v2c_service${path}`
    const req = https.get(url, {
      headers: { apikey: apiKey, Accept: 'application/json' },
      timeout: 15000,
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        try { resolve(JSON.parse(data)) } catch(e) { reject(new Error('JSON parse error')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

// ─── Fuel savings calc ────────────────────────────────────────────────────────
function calcSavings(vehicleId, kwh, totalCost, fuelPrice) {
  const config = {
    mg4:   { kwhPer100: 14.5, litresPer100: 6.0 },
    xpeng: { kwhPer100: 16.0, litresPer100: 7.5 },
  }
  const v = config[vehicleId]
  if (!v || !kwh) return null
  const fuelCost = (kwh / v.kwhPer100) * v.litresPer100 * (fuelPrice || 1.85)
  return parseFloat((fuelCost - totalCost).toFixed(2))
}
function parseSession(s, accountId, vehicleId, fuelPrice) {
  const start = new Date(s.startChargeDate)
  const end   = new Date(s.endChargeDate)
  const durationMin = Math.round((end - start) / 60000)
  const date = s.startChargeDate.slice(0, 10)
  const totalCost   = parseFloat((s.costFv  || 0).toFixed(4))
  const solarSavings = parseFloat(((s.cost || 0) - (s.costFv || 0)).toFixed(4))
  const fuelSavings = vehicleId ? global.calcSavings(vehicleId, s.energy, totalCost, fuelPrice) : null

  const startTime = s.startChargeDate.slice(11, 16) // HH:MM

  return {
    account_id: accountId, vehicle_id: vehicleId || 'unknown',
    location_id: 'home', location_name: 'Maison',
    provider: 'V2C', card: 'V2C Trydan',
    date, kwh: s.energy, total_cost: totalCost,
    duration_min: durationMin > 0 ? durationMin : null,
    source: 'v2c', v2c_id: s.id,
    start_time: startTime,
    solar_savings: solarSavings > 0 ? solarSavings : 0,
    fuel_savings: fuelSavings,
    needs_review: vehicleId ? 0 : 1,
  }
}

// ─── Insert session (dedup by v2c_id) ────────────────────────────────────────
const insertCharge = db.prepare(`
  INSERT OR IGNORE INTO charges
    (account_id, vehicle_id, location_id, location_name, provider, card, date, kwh,
     total_cost, duration_min, source, v2c_id, start_time, solar_savings, fuel_savings, needs_review)
  VALUES
    (@account_id, @vehicle_id, @location_id, @location_name, @provider, @card, @date, @kwh,
     @total_cost, @duration_min, @source, @v2c_id, @start_time, @solar_savings, @fuel_savings, @needs_review)
`)

// Add unique index for v2c_id dedup
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_charges_v2c_id ON charges(account_id, v2c_id) WHERE v2c_id IS NOT NULL') } catch(e) {}

// ─── Core sync function ───────────────────────────────────────────────────────
async function syncV2C(accountId, { startDate, endDate } = {}) {
  const settings = db.prepare('SELECT * FROM settings WHERE account_id = ?').get(accountId)
  if (!settings?.v2c_enabled || !settings?.v2c_api_key || !settings?.v2c_device_id) {
    addLog(accountId, 'warn', 'V2C non configuré ou désactivé')
    return { created: 0, skipped: 0, errors: 0 }
  }

  const { v2c_api_key: apiKey, v2c_device_id: deviceId, fuel_price: fuelPrice = 1.85 } = settings

  let path = `/stadistic/device?deviceId=${deviceId}`
  if (startDate) path += `&chargeDateStart=${startDate}`
  if (endDate)   path += `&chargeDateEnd=${endDate}`

  const isManual = !startDate // manual sync has no date range
  if (isManual) addLog(accountId, 'info', `Sync V2C → ${path}`)

  let sessions
  try {
    sessions = await v2cFetch(path, apiKey)
    if (!Array.isArray(sessions)) throw new Error('Réponse inattendue')
  } catch(e) {
    addLog(accountId, 'error', `Erreur API V2C: ${e.message}`)
    return { created: 0, skipped: 0, errors: 1 }
  }

  if (isManual) addLog(accountId, 'info', `${sessions.length} session(s) reçue(s)`)

  let created = 0, skipped = 0
  for (const s of sessions) {
    // Skip sessions without energy
    if (!s.energy || s.energy <= 0) {
      if (isManual) addLog(accountId, 'info', `Ignorée v2c_id=${s.id} — energy=0 (${s.startChargeDate})`)
      skipped++
      continue
    }
    if (!s.finished) {
      if (isManual) addLog(accountId, 'info', `Ignorée v2c_id=${s.id} — non terminée (${s.startChargeDate})`)
      skipped++
      continue
    }

    // Check already imported by v2c_id
    const exists = db.prepare('SELECT id FROM charges WHERE account_id=? AND v2c_id=?').get(accountId, s.id)
    if (exists) {
      if (isManual) addLog(accountId, 'info', `Ignorée v2c_id=${s.id} — déjà importée le ${s.startChargeDate} (charge id=${exists.id})`)
      skipped++
      continue
    }

    // Parse session data first
    const row = parseSession(s, accountId, null, fuelPrice)

    // Check if a manual charge matches this session (same date, and start_time if available)
    const manual = db.prepare(`
      SELECT id FROM charges
      WHERE account_id=? AND date=?
        AND source='manual' AND v2c_id IS NULL
        ${row.start_time ? "AND (start_time=? OR start_time IS NULL)" : ""}
      ORDER BY id DESC
      LIMIT 1
    `).get(accountId, row.date, ...(row.start_time ? [row.start_time] : []))

    if (manual) {
      // Enrich manual charge with V2C data
      db.prepare(`
        UPDATE charges SET
          v2c_id=@v2c_id, start_time=@start_time,
          kwh=@kwh, total_cost=@total_cost, duration_min=@duration_min,
          solar_savings=@solar_savings, fuel_savings=@fuel_savings,
          source='v2c', needs_review=0
        WHERE id=@id
      `).run({ ...row, id: manual.id })
      addLog(accountId, 'info', `✓ Enrichie charge manuelle id=${manual.id} avec v2c_id=${s.id} | ${s.energy} kWh | ${row.date} ${row.start_time}`)
      if (!settings.v2c_last_id || s.id > settings.v2c_last_id) {
        db.prepare('UPDATE settings SET v2c_last_id=? WHERE account_id=?').run(s.id, accountId)
      }
      created++
      continue
    }

    // Determine vehicle — for now null (needs_review=1), HA webhook will set it later
    const result = insertCharge.run(row)

    if (result.changes > 0) {
      addLog(accountId, 'info', `✓ Créée v2c_id=${s.id} | ${s.energy} kWh | ${row.date} | needs_review=${row.needs_review}`)
      if (!settings.v2c_last_id || s.id > settings.v2c_last_id) {
        db.prepare('UPDATE settings SET v2c_last_id=? WHERE account_id=?').run(s.id, accountId)
      }
      created++
    } else {
      addLog(accountId, 'warn', `INSERT ignoré v2c_id=${s.id} — doublon index unique (${row.date})`)
      skipped++
    }
  }

  if (isManual || created > 0) addLog(accountId, 'info', `Sync terminée: ${created} créée(s), ${skipped} ignorée(s)`)
  return { created, skipped, errors: 0 }
}

// ─── Historical sync: last 6 months by weekly chunks ─────────────────────────
async function syncV2CHistory(accountId) {
  addLog(accountId, 'info', '=== Sync historique V2C (6 mois par semaine) ===')
  const now   = new Date()
  const start = new Date(now)
  start.setMonth(start.getMonth() - 6)

  let totalCreated = 0, totalSkipped = 0, chunk = 0

  // Iterate week by week from oldest to newest
  let cursor = new Date(start)
  while (cursor < now) {
    const chunkStart = cursor.toISOString().slice(0, 10)
    const chunkEnd   = new Date(Math.min(cursor.getTime() + 7*24*3600*1000, now.getTime())).toISOString().slice(0, 10)
    chunk++

    addLog(accountId, 'info', `Chunk ${chunk}: ${chunkStart} → ${chunkEnd}`)
    const res = await syncV2C(accountId, { startDate: chunkStart, endDate: chunkEnd })
    totalCreated += res.created
    totalSkipped += res.skipped

    cursor.setDate(cursor.getDate() + 7)
    await new Promise(r => setTimeout(r, 200))
  }

  addLog(accountId, 'info', `=== Historique terminé: ${totalCreated} créée(s), ${totalSkipped} ignorée(s) sur ${chunk} chunks ===`)
  return { created: totalCreated, skipped: totalSkipped }
}

module.exports = { syncV2C, syncV2CHistory, addLog }
