const express = require('express')
const path = require('path')
const bcrypt = require('bcryptjs')
const db = require('./db')
const { signToken, requireAuth } = require('./auth')

const app = express()
app.use(express.json())

const CLIENT_DIST = path.join(__dirname, '../client/dist')

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { name, password, vehicleId } = req.body
  if (!name?.trim() || !password || !vehicleId) return res.status(400).json({ error: 'Champs manquants' })
  if (password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court' })

  const existing = db.prepare('SELECT id FROM accounts WHERE name = ?').get(name.trim())
  if (existing) return res.status(409).json({ error: 'Ce nom est déjà pris' })

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

// ─── Charges routes ───────────────────────────────────────────────────────────

app.get('/api/charges', requireAuth, (req, res) => {
  const charges = db.prepare(`
    SELECT * FROM charges WHERE account_id = ? ORDER BY date DESC, created_at DESC
  `).all(req.user.id)
  res.json(charges.map(toClient))
})

app.post('/api/charges', requireAuth, (req, res) => {
  const c = req.body
  const result = db.prepare(`
    INSERT INTO charges (account_id, vehicle_id, location_id, location_name, provider, card, date, kwh, total_cost, duration_min, odometer, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, c.vehicleId, c.locationId, c.locationName||null, c.provider||null, c.card||null, c.date, c.kwh, c.totalCost, c.durationMin||null, c.odometer||null, c.notes||null, c.source||'manual')

  // Save to lists
  if (c.provider) saveList(req.user.id, 'providers', c.provider)
  if (c.card)     saveList(req.user.id, 'cards', c.card)

  const charge = db.prepare('SELECT * FROM charges WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(toClient(charge))
})

app.put('/api/charges/:id', requireAuth, (req, res) => {
  const charge = db.prepare('SELECT * FROM charges WHERE id = ? AND account_id = ?').get(req.params.id, req.user.id)
  if (!charge) return res.status(404).json({ error: 'Session introuvable' })

  const c = req.body
  db.prepare(`
    UPDATE charges SET vehicle_id=?, location_id=?, location_name=?, provider=?, card=?, date=?, kwh=?, total_cost=?, duration_min=?, odometer=?, notes=?
    WHERE id=? AND account_id=?
  `).run(c.vehicleId, c.locationId, c.locationName||null, c.provider||null, c.card||null, c.date, c.kwh, c.totalCost, c.durationMin||null, c.odometer||null, c.notes||null, req.params.id, req.user.id)

  if (c.provider) saveList(req.user.id, 'providers', c.provider)
  if (c.card)     saveList(req.user.id, 'cards', c.card)

  res.json(toClient(db.prepare('SELECT * FROM charges WHERE id = ?').get(req.params.id)))
})

app.delete('/api/charges/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM charges WHERE id = ? AND account_id = ?').run(req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Session introuvable' })
  res.json({ ok: true })
})

// ─── Lists routes ─────────────────────────────────────────────────────────────

app.get('/api/lists', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT type, value FROM lists WHERE account_id = ? ORDER BY id DESC').all(req.user.id)
  const providers = rows.filter(r => r.type === 'providers').map(r => r.value)
  const cards     = rows.filter(r => r.type === 'cards').map(r => r.value)
  res.json({ providers, cards })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveList(accountId, type, value) {
  if (!value?.trim()) return
  db.prepare('INSERT OR IGNORE INTO lists (account_id, type, value) VALUES (?, ?, ?)').run(accountId, type, value.trim())
}

function toClient(c) {
  return {
    id:           c.id,
    vehicleId:    c.vehicle_id,
    locationId:   c.location_id,
    locationName: c.location_name,
    provider:     c.provider,
    card:         c.card,
    date:         c.date,
    kwh:          c.kwh,
    totalCost:    c.total_cost,
    durationMin:  c.duration_min,
    odometer:     c.odometer,
    notes:        c.notes,
    source:       c.source,
    createdAt:    c.created_at,
  }
}

// ─── Serve React app ──────────────────────────────────────────────────────────

app.use(express.static(CLIENT_DIST))
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'))
})

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3080
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EV Tracker running on port ${PORT}`)
})
