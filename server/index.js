const express = require('express')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const https = require('https')
const db = require('./db')
const { signToken, requireAuth } = require('./auth')

const app = express()
app.use(express.json())

const CLIENT_DIST = path.join(__dirname, '../client/dist')

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { name, password, vehicleId } = req.body
  if (!name?.trim() || !password || !vehicleId) return res.status(400).json({ error: 'Champs manquants' })
  if (password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court' })
  if (db.prepare('SELECT id FROM accounts WHERE name = ?').get(name.trim()))
    return res.status(409).json({ error: 'Ce nom est déjà pris' })
  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare('INSERT INTO accounts (name, password_hash, vehicle_id) VALUES (?, ?, ?)').run(name.trim(), hash, vehicleId)
  const account = db.prepare('SELECT id, name, vehicle_id FROM accounts WHERE id = ?').get(result.lastInsertRowid)
  res.json({ token: signToken(account), account: { id: account.id, name: account.name, vehicleId: account.vehicle_id } })
})

app.post('/api/auth/login', (req, res) => {
  const { name, password } = req.body
  if (!name?.trim() || !password) return res.status(400).json({ error: 'Champs manquants' })
  const account = db.prepare('SELECT * FROM accounts WHERE name = ?').get(name.trim())
  if (!account || !bcrypt.compareSync(password, account.password_hash))
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
  res.json({ token: signToken(account), account: { id: account.id, name: account.name, vehicleId: account.vehicle_id } })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  const account = db.prepare('SELECT id, name, vehicle_id FROM accounts WHERE id = ?').get(req.user.id)
  if (!account) return res.status(404).json({ error: 'Compte introuvable' })
  res.json({ id: account.id, name: account.name, vehicleId: account.vehicle_id })
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE account_id = ?').get(req.user.id)
  res.json(s ? toClientSettings(s) : {})
})

app.put('/api/settings', requireAuth, (req, res) => {
  const { ocmApiKey, homeLat, homeLng, homeLabel, fuelPrice, v2cEnabled, v2cApiKey, v2cDeviceId } = req.body
  const existing = db.prepare('SELECT id FROM settings WHERE account_id = ?').get(req.user.id)
  if (existing) {
    db.prepare('UPDATE settings SET ocm_api_key=?, home_lat=?, home_lng=?, home_label=?, fuel_price=?, v2c_enabled=?, v2c_api_key=?, v2c_device_id=? WHERE account_id=?')
      .run(ocmApiKey||null, homeLat||null, homeLng||null, homeLabel||null, fuelPrice||1.85, v2cEnabled?1:0, v2cApiKey||null, v2cDeviceId||null, req.user.id)
  } else {
    db.prepare('INSERT INTO settings (account_id, ocm_api_key, home_lat, home_lng, home_label, fuel_price, v2c_enabled, v2c_api_key, v2c_device_id) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(req.user.id, ocmApiKey||null, homeLat||null, homeLng||null, homeLabel||null, fuelPrice||1.85, v2cEnabled?1:0, v2cApiKey||null, v2cDeviceId||null)
  }
  const s = db.prepare('SELECT * FROM settings WHERE account_id = ?').get(req.user.id)
  res.json(toClientSettings(s))
})

// ─── OCM proxy ────────────────────────────────────────────────────────────────

// Search charging stations by name/location
app.get('/api/ocm/search', requireAuth, (req, res) => {
  const s = db.prepare('SELECT ocm_api_key FROM settings WHERE account_id = ?').get(req.user.id)
  const apiKey = s?.ocm_api_key || ''
  const { q, lat, lng, radius } = req.query
  const dist = parseInt(radius) || 50
  const maxResults = dist > 25 ? 500 : 500

  function normalize(stations) {
    return stations.map(s => {
      const connections = s.Connections || []
      const connectorTypes = [...new Set(
        connections
          .map(c => c.ConnectionType?.Title || c.ConnectionType?.FormalName || '')
          .filter(Boolean)
          .map(t => {
            if (t.includes('CCS') || t.includes('Combo')) return 'CCS'
            if (t.includes('CHAdeMO')) return 'CHAdeMO'
            if (t.includes('Type 2') || t.includes('Mennekes')) return 'Type 2'
            if (t.includes('Type 1')) return 'Type 1'
            if (t.includes('Tesla')) return 'Tesla'
            return t.split('(')[0].trim()
          })
      )]
      const maxPower = Math.max(0, ...connections.map(c => c.PowerKW || 0)) || null
      const operator = s.OperatorInfo?.Title || ''
      return {
        id: s.ID, name: s.AddressInfo?.Title || '',
        address: s.AddressInfo?.AddressLine1 || '',
        city: s.AddressInfo?.Town || '',
        lat: s.AddressInfo?.Latitude, lng: s.AddressInfo?.Longitude,
        operator, network: operator,
        power: maxPower, connectorTypes,
        totalPoints: connections.length,
      }
    })
  }

  function fetchOCM(url) {
    return new Promise((resolve) => {
      https.get(url, (r) => {
        let d = ''
        r.on('data', c => d += c)
        r.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve([]) } })
      }).on('error', () => resolve([]))
    })
  }

  let url = `https://api.openchargemap.io/v3/poi/?output=json&maxresults=${maxResults}&compact=false&verbose=true${apiKey?'&key='+apiKey:''}`

  if (lat && lng) {
    url += `&latitude=${lat}&longitude=${lng}&distance=${dist || 50}&distanceunit=KM`
  } else if (q) {
    url += `&cityname=${encodeURIComponent(q)}`
  }

  fetchOCM(url).then(stations => res.json(normalize(stations))).catch(() => res.json([]))
})

// Geocode worldwide — returns structured results for display
app.get('/api/geocode', requireAuth, (req, res) => {
  const { q } = req.query
  if (!q) return res.json([])
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1&accept-language=fr`
  const options = { headers: { 'User-Agent': 'EV-Charge-Tracker/1.0' } }
  https.get(url, options, (apiRes) => {
    let data = ''
    apiRes.on('data', chunk => data += chunk)
    apiRes.on('end', () => {
      try {
        const results = JSON.parse(data)
        res.json(results.map(r => {
          const a = r.address || {}
          const isFr = a.country_code?.toLowerCase() === 'fr'

          // Primary name: most specific place
          const name = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || r.display_name.split(',')[0].trim()

          // Department / county
          const dept = a.county || a.state_district || ''

          // Region / state
          const region = a.state || ''

          // Country (always show, helps disambiguation)
          const country = a.country || ''

          // Postcode
          const postcode = a.postcode || ''

          return {
            label: r.display_name,   // full string, for internal use
            name,                     // primary display name
            postcode,
            dept,
            region,
            country,
            isFr,
            type: r.type || r.class, // city, town, village, etc.
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          }
        }))
      } catch { res.json([]) }
    })
  }).on('error', () => res.json([]))
})

// ─── Favorites recalculation ─────────────────────────────────────────────────

function recalcFavorites(accountId) {
  // Runs in a transaction — atomic, logged on error, never blocks the HTTP response
  const run = db.transaction(() => {
    db.prepare('DELETE FROM favorite_locations WHERE account_id = ?').run(accountId)

    const groups = db.prepare(`
      SELECT
        COALESCE(location_name, provider) as label,
        provider,
        location_id,
        lat, lng, ocm_id,
        power_kw, connector_types,
        COUNT(*) as use_count,
        MAX(date) as last_used
      FROM charges
      WHERE account_id = ?
        AND location_id != 'home'
        AND COALESCE(location_name, provider) IS NOT NULL
        AND COALESCE(location_name, provider) != ''
      GROUP BY COALESCE(location_name, provider)
      ORDER BY use_count DESC, last_used DESC
    `).all(accountId)

    const insert = db.prepare(`
      INSERT INTO favorite_locations
        (account_id, label, provider, location_id, lat, lng, ocm_id, operator, power_kw, connector_types, use_count, last_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const g of groups) {
      insert.run(
        accountId, g.label, g.provider || null, g.location_id,
        g.lat || null, g.lng || null, g.ocm_id || null,
        g.provider || null, g.power_kw || null,
        g.connector_types || null,
        g.use_count, g.last_used
      )
    }
  })

  try {
    run()
  } catch(e) {
    // Log but never throw — favorites are non-critical, charge is already saved
    console.error('[recalcFavorites] account', accountId, ':', e.message)
  }
}

// ─── Charges ──────────────────────────────────────────────────────────────────

app.get('/api/charges', requireAuth, (req, res) => {
  const charges = db.prepare('SELECT * FROM charges WHERE account_id = ? ORDER BY date DESC, created_at DESC').all(req.user.id)
  res.json(charges.map(toClient))
})

app.post('/api/charges', requireAuth, (req, res) => {
  const c = req.body
  const result = db.prepare(`
    INSERT INTO charges (account_id, vehicle_id, location_id, location_name, provider, card, date, kwh, total_cost, duration_min, odometer, notes, source, lat, lng, location_approximate, ocm_id, power_kw, connector_types)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, c.vehicleId, c.locationId, c.locationName||null, c.provider||null, c.card||null, c.date, c.kwh, c.totalCost, c.durationMin||null, c.odometer||null, c.notes||null, c.source||'manual', c.lat||null, c.lng||null, c.locationApproximate?1:0, c.ocmId||null, c.powerKw||null, c.connectorTypes?.length ? JSON.stringify(c.connectorTypes) : null)
  if (c.provider) saveList(req.user.id, 'providers', c.provider)
  if (c.card)     saveList(req.user.id, 'cards', c.card)
  // Compute fuel savings
  const settings201 = db.prepare('SELECT fuel_price FROM settings WHERE account_id = ?').get(req.user.id)
  const fuelPrice201 = settings201?.fuel_price || 1.85
  const savings201 = global.calcSavings(c.vehicleId, c.kwh, c.totalCost, fuelPrice201)
  if (savings201 !== null) db.prepare('UPDATE charges SET fuel_savings = ? WHERE id = ?').run(savings201, result.lastInsertRowid)
  recalcFavorites(req.user.id)
  res.status(201).json(toClient(db.prepare('SELECT * FROM charges WHERE id = ?').get(result.lastInsertRowid)))
})

app.put('/api/charges/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM charges WHERE id = ? AND account_id = ?').get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Session introuvable' })
  const c = req.body
  db.prepare(`
    UPDATE charges SET vehicle_id=?, location_id=?, location_name=?, provider=?, card=?, date=?, kwh=?, total_cost=?, duration_min=?, odometer=?, notes=?, lat=?, lng=?, location_approximate=?, ocm_id=?, power_kw=?, connector_types=?
    WHERE id=? AND account_id=?
  `).run(c.vehicleId, c.locationId, c.locationName||null, c.provider||null, c.card||null, c.date, c.kwh, c.totalCost, c.durationMin||null, c.odometer||null, c.notes||null, c.lat||null, c.lng||null, c.locationApproximate?1:0, c.ocmId||null, c.powerKw||null, c.connectorTypes?.length ? JSON.stringify(c.connectorTypes) : null, req.params.id, req.user.id)
  if (c.provider) saveList(req.user.id, 'providers', c.provider)
  if (c.card)     saveList(req.user.id, 'cards', c.card)
  const settings204 = db.prepare('SELECT fuel_price FROM settings WHERE account_id = ?').get(req.user.id)
  const fuelPrice204 = settings204?.fuel_price || 1.85
  const savings204 = global.calcSavings(c.vehicleId, c.kwh, c.totalCost, fuelPrice204)
  if (savings204 !== null) db.prepare('UPDATE charges SET fuel_savings = ? WHERE id = ?').run(savings204, req.params.id)
  recalcFavorites(req.user.id)
  res.json(toClient(db.prepare('SELECT * FROM charges WHERE id = ?').get(req.params.id)))
})

app.delete('/api/charges/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM charges WHERE id = ? AND account_id = ?').run(req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Session introuvable' })
  recalcFavorites(req.user.id)
  res.json({ ok: true })
})

// ─── Lists ────────────────────────────────────────────────────────────────────

app.get('/api/lists', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT type, value FROM lists WHERE account_id = ? ORDER BY id DESC').all(req.user.id)
  res.json({
    providers: rows.filter(r => r.type === 'providers').map(r => r.value),
    cards:     rows.filter(r => r.type === 'cards').map(r => r.value),
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveList(accountId, type, value) {
  if (!value?.trim()) return
  db.prepare('INSERT OR IGNORE INTO lists (account_id, type, value) VALUES (?,?,?)').run(accountId, type, value.trim())
}

function toClient(c) {
  return {
    id: c.id, vehicleId: c.vehicle_id, locationId: c.location_id, fuelSavings: c.fuel_savings, solarSavings: c.solar_savings, needsReview: !!c.needs_review, v2cId: c.v2c_id,
    locationName: c.location_name, provider: c.provider, card: c.card,
    date: c.date, kwh: c.kwh, totalCost: c.total_cost,
    durationMin: c.duration_min, odometer: c.odometer, notes: c.notes,
    source: c.source, lat: c.lat, lng: c.lng,
    locationApproximate: !!c.location_approximate, ocmId: c.ocm_id,
    powerKw: c.power_kw,
    connectorTypes: c.connector_types ? JSON.parse(c.connector_types) : [],
    createdAt: c.created_at,
  }
}

function toClientSettings(s) {
  return {
    ocmApiKey:  s.ocm_api_key  || '',
    homeLat:    s.home_lat,
    homeLng:    s.home_lng,
    homeLabel:  s.home_label   || '',
    fuelPrice:  s.fuel_price   || 1.85,
    v2cEnabled: !!s.v2c_enabled,
    v2cApiKey:  s.v2c_api_key  || '',
    v2cDeviceId:s.v2c_device_id|| '',
  }
}

// ─── Favorite locations ──────────────────────────────────────────────────────

app.get('/api/favorites', requireAuth, (req, res) => {
  const favs = db.prepare(`
    SELECT * FROM favorite_locations WHERE account_id = ?
    ORDER BY use_count DESC, last_used DESC LIMIT 20
  `).all(req.user.id)
  res.json(favs.map(f => ({
    id: f.id, label: f.label, provider: f.provider,
    locationId: f.location_id, lat: f.lat, lng: f.lng,
    ocmId: f.ocm_id, operator: f.operator,
    powerKw: f.power_kw,
    connectorTypes: f.connector_types ? JSON.parse(f.connector_types) : [],
    useCount: f.use_count, lastUsed: f.last_used,
  })))
})

app.post('/api/favorites/bump', requireAuth, (req, res) => {
  const { label, provider, locationId, lat, lng, ocmId, operator, powerKw, connectorTypes } = req.body
  if (!label) return res.status(400).json({ error: 'label required' })
  const existing = db.prepare('SELECT id FROM favorite_locations WHERE account_id = ? AND label = ?').get(req.user.id, label)
  if (existing) {
    db.prepare(`UPDATE favorite_locations SET use_count = use_count + 1, last_used = datetime('now'), provider=?, operator=?, power_kw=?, connector_types=? WHERE id=?`)
      .run(provider||null, operator||null, powerKw||null, connectorTypes?.length ? JSON.stringify(connectorTypes) : null, existing.id)
  } else {
    db.prepare(`INSERT INTO favorite_locations (account_id, label, provider, location_id, lat, lng, ocm_id, operator, power_kw, connector_types)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id, label, provider||null, locationId||'ext', lat||null, lng||null, ocmId||null, operator||null, powerKw||null, connectorTypes?.length ? JSON.stringify(connectorTypes) : null)
  }
  res.json({ ok: true })
})

app.delete('/api/favorites/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM favorite_locations WHERE id = ? AND account_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ─── CSV Import ──────────────────────────────────────────────────────────────

app.post('/api/import/charges', requireAuth, (req, res) => {
  const { rows } = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Aucune ligne' })

  const insert = db.prepare(`
    INSERT INTO charges
      (account_id, vehicle_id, location_id, location_name, provider, card, date, kwh, total_cost, duration_min, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `)

  const errors = []
  let imported = 0

  const run = db.transaction(() => {
    for (const r of rows) {
      try {
        // Basic validation
        if (!r.date || !r.vehicleId || !r.kwh) throw new Error('Champs requis manquants')
        const kwh = parseFloat(r.kwh)
        const cost = parseFloat(r.totalCost ?? 0)
        const dur  = r.durationMin ? parseInt(r.durationMin) : null
        if (isNaN(kwh) || kwh <= 0) throw new Error(`kWh invalide: ${r.kwh}`)

        insert.run(
          req.user.id,
          r.vehicleId || 'mg4',
          r.locationId || 'home',
          r.locationName || (r.locationId === 'home' ? 'Maison' : 'Externe'),
          r.provider || null,
          r.card || null,
          r.date,
          kwh,
          isNaN(cost) ? 0 : cost,
          dur,
          'import'
        )
        imported++
      } catch(e) {
        errors.push({ row: r, error: e.message })
      }
    }
  })

  try {
    run()
    recalcFavorites(req.user.id)
    res.json({ imported, errors })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── V2C Sync endpoints ──────────────────────────────────────────────────────

app.post('/api/v2c/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncV2C(req.user.id)
    res.json(result)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/v2c/sync/history', requireAuth, async (req, res) => {
  try {
    const result = await syncV2CHistory(req.user.id)
    res.json(result)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ─── Sync log endpoints ──────────────────────────────────────────────────────

app.get('/api/logs', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500)
  const logs = db.prepare('SELECT * FROM sync_log WHERE account_id=? ORDER BY created_at DESC LIMIT ?').all(req.user.id, limit)
  res.json(logs)
})

app.delete('/api/logs', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sync_log WHERE account_id=?').run(req.user.id)
  res.json({ ok: true })
})

// ─── Operator logos ──────────────────────────────────────────────────────────

// /api/logos/providers/:name  or  /api/logos/cards/:name
app.get('/api/logos/:type/:name', (req, res) => {
  const { type, name: rawName } = req.params
  if (!['providers', 'cards'].includes(type)) return res.status(400).end()

  const DATA_DIR    = process.env.DATA_DIR || path.join(__dirname, '../data')
  const BUNDLED_DIR = path.join(__dirname, '../bundled-logos', type)

  const name = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const exts = ['png', 'svg', 'jpg', 'jpeg', 'webp']
  const mime = { svg:'image/svg+xml', webp:'image/webp', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg' }

  // 1. Look in volume (user custom logos)
  const customDir = path.join(DATA_DIR, 'logos', type)
  if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true })
  for (const ext of exts) {
    const file = path.join(customDir, `${name}.${ext}`)
    if (fs.existsSync(file)) {
      res.setHeader('Content-Type', mime[ext] || 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.sendFile(file)
    }
  }

  // 2. Fallback to bundled logos (in image)
  for (const ext of exts) {
    const file = path.join(BUNDLED_DIR, `${name}.${ext}`)
    if (fs.existsSync(file)) {
      res.setHeader('Content-Type', mime[ext] || 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.sendFile(file)
    }
  }

  res.status(404).end()
})

// Legacy route kept for compatibility
app.get('/api/logos/:name', (req, res) => res.redirect(`/api/logos/providers/${req.params.name}`))

// ─── Static ───────────────────────────────────────────────────────────────────

app.use(express.static(CLIENT_DIST))
app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')))

const PORT = process.env.PORT || 3080
app.listen(PORT, '0.0.0.0', () => console.log(`EV Tracker on port ${PORT}`))

// ─── V2C auto-sync cron (every 10 min) ───────────────────────────────────────
setInterval(async () => {
  try {
    const accounts = db.prepare("SELECT id FROM settings WHERE v2c_enabled=1 AND v2c_api_key IS NOT NULL AND v2c_device_id IS NOT NULL").all()
    for (const acc of accounts) {
      await syncV2C(acc.id)
    }
  } catch(e) { console.error('[cron v2c]', e.message) }
}, 10 * 60 * 1000)
