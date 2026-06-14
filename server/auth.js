const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'ev-tracker-dev-secret-change-in-prod'

function signToken(account) {
  return jwt.sign({ id: account.id, name: account.name, vehicleId: account.vehicle_id }, JWT_SECRET, { expiresIn: '30d' })
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Non authentifié' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

module.exports = { signToken, requireAuth, JWT_SECRET }
