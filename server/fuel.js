const https = require('https')

// ─── Prix des carburants en France — Flux instantané v2 (data.economie.gouv.fr)
// API publique, sans clé. ODS Explore v2.1. Champs confirmés: sp95_prix,
// gazole_prix, geom (geo_point_2d). Mise à jour ~10 min par les stations.
const HOST    = 'data.economie.gouv.fr'
const DATASET = 'prix-des-carburants-en-france-flux-instantane-v2'
const TIMEOUT_MS = 6000

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ev-tracker' } }, (r) => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => {
        try { resolve(JSON.parse(d)) } catch(e) { reject(new Error('Réponse invalide data.gouv.fr')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Timeout data.gouv.fr')))
  })
}

function avg(values) {
  const valid = values.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
  if (!valid.length) return null
  return Math.round((valid.reduce((s,v) => s+v, 0) / valid.length) * 1000) / 1000
}

// Recherche les stations dans un rayon (km) autour d'un point GPS et calcule
// la moyenne des prix SP95 et Gazole. Élargit progressivement le rayon si
// aucune station n'est trouvée (zones rurales/montagneuses).
async function getFuelPricesNear(lat, lng) {
  if (!lat || !lng) return { available: false, reason: 'Pas de coordonnées GPS pour cette session' }

  const radii = [10, 25, 50]
  for (const km of radii) {
    const where = `within_distance(geom, geom'POINT(${lng} ${lat})', ${km}km)`
    const url = `https://${HOST}/api/explore/v2.1/catalog/datasets/${DATASET}/records`
      + `?where=${encodeURIComponent(where)}&select=sp95_prix,gazole_prix&limit=100`
    try {
      const data = await httpGetJson(url)
      const results = data?.results || []
      if (results.length) {
        const sp95Avg   = avg(results.map(r => r.sp95_prix))
        const gazoleAvg = avg(results.map(r => r.gazole_prix))
        if (sp95Avg !== null || gazoleAvg !== null) {
          return { available: true, sp95Avg, gazoleAvg, stationCount: results.length, radiusKm: km }
        }
      }
    } catch(e) {
      // Échec réseau/timeout sur ce rayon : on tente le rayon suivant, puis on
      // abandonnera proprement si tous échouent (le fallback est géré par l'appelant).
    }
  }
  return { available: false, reason: 'Aucune station trouvée à proximité' }
}

// MG4 (citadine/compacte) se compare à un équivalent essence (SP95).
// Xpeng G6 (SUV) se compare à un équivalent diesel (Gazole), plus représentatif
// du segment thermique correspondant.
const FUEL_TYPE_BY_VEHICLE = { mg4: 'sp95', xpeng: 'gazole' }

// Détermine le prix carburant à utiliser pour le calcul du gain thermique d'une
// session: moyenne des stations data.gouv.fr autour du point de charge si on a
// des coordonnées GPS, sinon le prix de secours configuré dans les réglages.
async function resolveFuelPrice(vehicleId, lat, lng, fallbackPrice) {
  const fuelType = FUEL_TYPE_BY_VEHICLE[vehicleId] || 'sp95'
  if (lat && lng) {
    try {
      const r = await getFuelPricesNear(lat, lng)
      if (r.available) {
        const price = fuelType === 'gazole' ? r.gazoleAvg : r.sp95Avg
        if (price) return { price, fuelType, source: 'auto' }
      }
    } catch(e) {
      // tout échec retombe sur le prix de secours ci-dessous
    }
  }
  return { price: fallbackPrice || 1.85, fuelType, source: 'manual' }
}

module.exports = { getFuelPricesNear, resolveFuelPrice, FUEL_TYPE_BY_VEHICLE }
