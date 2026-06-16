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

// ─── Parse V2C session → charge row ──────────────────────────────────────────
function parseSession(s, accountId, vehicleId, fuelPrice) {
  const start = new Date(s.startChargeDate)
  const end   = new Date(s.endChargeDate)
  const durationMin = Math.round((end - start) / 60000)
  const date = s.startChargeDate.slice(0, 10)
  const totalCost   = parseFloat((s.costFv  || 0).toFixed(4))
  const solarSavings = parseFloat(((s.cost || 0) - (s.costFv || 0)).toFixed(4))
  const fuelSavings = vehicleId ? global.calcSavings(vehicleId, s.energy, totalCost, fuelPrice) : null

  return {
    account_id: accountId, vehicle_id: vehicleId || null,
    location_id: 'home', location_name: 'Maison',
    provider: 'V2C Trydan', card: 'V2C Trydan',
    date, kwh: s.energy, total_cost: totalCost,
    duration_min: durationMin > 0 ? durationMin : null,
    source: 'v2c', v2c_id: s.id,
    solar_savings: solarSavings > 0 ? solarSavings : 0,
    fuel_savings: fuelSavings,
    needs_review: vehicleId ? 0 : 1,
  }
}

// ─── Insert session (dedup by v2c_id) ────────────────────────────────────────
const insertCharge = db.prepare(`
  INSERT OR IGNORE INTO charges
    (account_id, vehicle_id, location_id, location_name, provider, card, date, kwh,
     total_cost, duration_min, source, v2c_id, solar_savings, fuel_savings, needs_review)
  VALUES
    (@account_id, @vehicle_id, @location_id, @location_name, @provider, @card, @date, @kwh,
     @total_cost, @duration_min, @source, @v2c_id, @solar_savings, @fuel_savings, @needs_review)
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

  addLog(accountId, 'info', `Sync V2C → ${path}`)

  let sessions
  try {
    sessions = await v2cFetch(path, apiKey)
    if (!Array.isArray(sessions)) throw new Error('Réponse inattendue')
  } catch(e) {
    addLog(accountId, 'error', `Erreur API V2C: ${e.message}`)
    return { created: 0, skipped: 0, errors: 1 }
  }

  addLog(accountId, 'info', `${sessions.length} session(s) reçue(s)`)

  let created = 0, skipped = 0
  for (const s of sessions) {
    // Skip sessions without energy
    if (!s.energy || s.energy <= 0) {
      addLog(accountId, 'info', `Ignorée v2c_id=${s.id} (energy=0)`)
      skipped++
      continue
    }
    if (!s.finished) {
      addLog(accountId, 'info', `Ignorée v2c_id=${s.id} (non terminée)`)
      skipped++
      continue
    }

    // Check already imported
    const exists = db.prepare('SELECT id FROM charges WHERE account_id=? AND v2c_id=?').get(accountId, s.id)
    if (exists) {
      addLog(accountId, 'info', `Déjà importée v2c_id=${s.id}`)
      skipped++
      continue
    }

    // Determine vehicle — for now null (needs_review=1), HA webhook will set it later
    const row = parseSession(s, accountId, null, fuelPrice)
    const result = insertCharge.run(row)

    if (result.changes > 0) {
      addLog(accountId, 'info', `✓ Créée v2c_id=${s.id} | ${s.energy} kWh | ${row.date} | needs_review=${row.needs_review}`)
      // Update last known id
      if (!settings.v2c_last_id || s.id > settings.v2c_last_id) {
        db.prepare('UPDATE settings SET v2c_last_id=? WHERE account_id=?').run(s.id, accountId)
      }
      created++
    } else {
      skipped++
    }
  }

  addLog(accountId, 'info', `Sync terminée: ${created} créée(s), ${skipped} ignorée(s)`)
  return { created, skipped, errors: 0 }
}

// ─── Historical sync: last 6 months by 30-day chunks ─────────────────────────
async function syncV2CHistory(accountId) {
  addLog(accountId, 'info', '=== Sync historique V2C (6 mois) ===')
  const now   = new Date()
  let totalCreated = 0, totalSkipped = 0

  for (let i = 0; i < 6; i++) {
    const end   = new Date(now)
    end.setMonth(end.getMonth() - i)
    const start = new Date(end)
    start.setDate(1)

    const startDate = start.toISOString().slice(0, 10)
    const endDate   = end.toISOString().slice(0, 10)

    addLog(accountId, 'info', `Chunk ${i+1}/6: ${startDate} → ${endDate}`)
    const res = await syncV2C(accountId, { startDate, endDate })
    totalCreated += res.created
    totalSkipped += res.skipped

    // Small delay between calls to respect rate limits
    await new Promise(r => setTimeout(r, 300))
  }

  addLog(accountId, 'info', `=== Historique terminé: ${totalCreated} créée(s), ${totalSkipped} ignorée(s) ===`)
  return { created: totalCreated, skipped: totalSkipped }
}

module.exports = { syncV2C, syncV2CHistory, addLog }
