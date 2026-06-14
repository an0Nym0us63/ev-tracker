const express = require('express')
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
  const { ocmApiKey, homeLat, homeLng, homeLabel } = req.body
  const existing = db.prepare('SELECT id FROM settings WHERE account_id = ?').get(req.user.id)
  if (existing) {
    db.prepare('UPDATE settings SET ocm_api_key=?, home_lat=?, home_lng=?, home_label=? WHERE account_id=?')
      .run(ocmApiKey||null, homeLat||null, homeLng||null, homeLabel||null, req.user.id)
  } else {
    db.prepare('INSERT INTO settings (account_id, ocm_api_key, home_lat, home_lng, home_label) VALUES (?,?,?,?,?)')
      .run(req.user.id, ocmApiKey||null, homeLat||null, homeLng||null, homeLabel||null)
  }
  const s = db.prepare('SELECT * FROM settings WHERE account_id = ?').get(req.user.id)
  res.json(toClientSettings(s))
})

// ─── OCM proxy ────────────────────────────────────────────────────────────────

// Search charging stations by name/location
app.get('/api/ocm/search', requireAuth, (req, res) => {
  const s = db.prepare('SELECT ocm_api_key FROM settings WHERE account_id = ?').get(req.user.id)
  if (!s?.ocm_api_key) return res.json([])

  const { q, lat, lng } = req.query
  // 100 results, no country restriction, 25km radius — client filters
  let url = `https://api.openchargemap.io/v3/poi/?output=json&maxresults=100&compact=true&verbose=false&key=${s.ocm_api_key}`
  if (lat && lng) { url += `&latitude=${lat}&longitude=${lng}&distance=25&distanceunit=KM` } else if (q) { url += `&cityname=${encodeURIComponent(q)}` }
  

  https.get(url, (apiRes) => {
    let data = ''
    apiRes.on('data', chunk => data += chunk)
    apiRes.on('end', () => {
      try {
        const stations = JSON.parse(data)
        res.json(stations.map(s => ({
          id:       s.ID,
          name:     s.AddressInfo?.Title || '',
          address:  s.AddressInfo?.AddressLine1 || '',
          city:     s.AddressInfo?.Town || '',
          lat:      s.AddressInfo?.Latitude,
          lng:      s.AddressInfo?.Longitude,
          operator: s.OperatorInfo?.Title || '',
          power:    s.Connections?.[0]?.PowerKW || null,
        })))
      } catch { res.json([]) }
    })
  }).on('error', () => res.json([]))
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

// ─── Charges ──────────────────────────────────────────────────────────────────

app.get('/api/charges', requireAuth, (req, res) => {
  const charges = db.prepare('SELECT * FROM charges WHERE account_id = ? ORDER BY date DESC, created_at DESC').all(req.user.id)
  res.json(charges.map(toClient))
})

app.post('/api/charges', requireAuth, (req, res) => {
  const c = req.body
  const result = db.prepare(`
    INSERT INTO charges (account_id, vehicle_id, location_id, location_name, provider, card, date, kwh, total_cost, duration_min, odometer, notes, source, lat, lng, location_approximate, ocm_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, c.vehicleId, c.locationId, c.locationName||null, c.provider||null, c.card||null, c.date, c.kwh, c.totalCost, c.durationMin||null, c.odometer||null, c.notes||null, c.source||'manual', c.lat||null, c.lng||null, c.locationApproximate?1:0, c.ocmId||null)
  if (c.provider) saveList(req.user.id, 'providers', c.provider)
  if (c.card)     saveList(req.user.id, 'cards', c.card)
  res.status(201).json(toClient(db.prepare('SELECT * FROM charges WHERE id = ?').get(result.lastInsertRowid)))
})

app.put('/api/charges/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM charges WHERE id = ? AND account_id = ?').get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Session introuvable' })
  const c = req.body
  db.prepare(`
    UPDATE charges SET vehicle_id=?, location_id=?, location_name=?, provider=?, card=?, date=?, kwh=?, total_cost=?, duration_min=?, odometer=?, notes=?, lat=?, lng=?, location_approximate=?, ocm_id=?
    WHERE id=? AND account_id=?
  `).run(c.vehicleId, c.locationId, c.locationName||null, c.provider||null, c.card||null, c.date, c.kwh, c.totalCost, c.durationMin||null, c.odometer||null, c.notes||null, c.lat||null, c.lng||null, c.locationApproximate?1:0, c.ocmId||null, req.params.id, req.user.id)
  if (c.provider) saveList(req.user.id, 'providers', c.provider)
  if (c.card)     saveList(req.user.id, 'cards', c.card)
  res.json(toClient(db.prepare('SELECT * FROM charges WHERE id = ?').get(req.params.id)))
})

app.delete('/api/charges/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM charges WHERE id = ? AND account_id = ?').run(req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Session introuvable' })
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
    id: c.id, vehicleId: c.vehicle_id, locationId: c.location_id,
    locationName: c.location_name, provider: c.provider, card: c.card,
    date: c.date, kwh: c.kwh, totalCost: c.total_cost,
    durationMin: c.duration_min, odometer: c.odometer, notes: c.notes,
    source: c.source, lat: c.lat, lng: c.lng,
    locationApproximate: !!c.location_approximate, ocmId: c.ocm_id,
    createdAt: c.created_at,
  }
}

function toClientSettings(s) {
  return {
    ocmApiKey:  s.ocm_api_key  || '',
    homeLat:    s.home_lat,
    homeLng:    s.home_lng,
    homeLabel:  s.home_label   || '',
  }
}

// ─── Static ───────────────────────────────────────────────────────────────────

app.use(express.static(CLIENT_DIST))
app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')))

const PORT = process.env.PORT || 3080
app.listen(PORT, '0.0.0.0', () => console.log(`EV Tracker on port ${PORT}`))
