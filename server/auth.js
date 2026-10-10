const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'ev-tracker-dev-secret-change-in-prod'

function signToken(account) {
  return jwt.sign({ id: account.id, name: account.name, vehicleId: account.vehicle_id }, JWT_SECRET, { expiresIn: '30d' })
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Non authentifié' })
  let user
  try {
    user = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
  // Un jeton vit 30 jours : sans cette verification, un compte supprime dans
  // les Reglages garderait l'acces jusqu'a son expiration.
  const db = require('./db')
  if (!db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(user.id))
    return res.status(401).json({ error: 'Compte supprimé' })
  req.user = user
  next()
}

module.exports = { signToken, requireAuth, JWT_SECRET }
