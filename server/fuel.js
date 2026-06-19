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
      + `?where=${encodeURIComponent(where)}&select=sp95_prix,e10_prix,gazole_prix,adresse,ville&limit=100`
    try {
      const data = await httpGetJson(url)
      const results = data?.results || []
      if (results.length) {
        console.log(`[fuel] Rayon ${km}km autour de (${lat}, ${lng}) — ${results.length} station(s) :`)
        results.forEach(r => {
          const loc = [r.adresse, r.ville].filter(Boolean).join(', ') || '(inconnu)'
          console.log(`  - ${loc} | SP95=${r.sp95_prix ?? '—'} SP95-E10=${r.sp95_e10_prix ?? '—'} Gazole=${r.gazole_prix ?? '—'}`)
        })

        console.log(`[fuel] Rayon ${km}km autour de (${lat}, ${lng}) — ${results.length} station(s) :`)
        results.forEach(r => {
          const loc = [r.adresse, r.ville].filter(Boolean).join(', ') || '(inconnu)'
          console.log(`  - ${loc} | SP95=${r.sp95_prix ?? '—'} E10=${r.e10_prix ?? '—'} Gazole=${r.gazole_prix ?? '—'}`)
        })
        // SP95 (E5) et E10 regroupés — même catégorie essence, prix proches
        const sp95Vals = results.flatMap(r => [r.sp95_prix, r.e10_prix])
        const sp95Avg   = avg(sp95Vals)
        const gazoleAvg = avg(results.map(r => r.gazole_prix))
        const sp95Count = sp95Vals.filter(v => Number.isFinite(Number(v)) && Number(v) > 0).length
        if (sp95Count < 3) console.log(`[fuel] ⚠️  Seulement ${sp95Count} prix essence — moyenne peu représentative`)
        console.log(`[fuel] → moyenne essence=${sp95Avg} Gazole=${gazoleAvg}`)
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

// L'API data.gouv.fr n'expose que le prix ACTUEL (flux instantané, ~10 min).
// Il n'existe pas d'historique requêtable par date+position en direct (seul un
// export ZIP annuel brut existe, pas exploitable à la volée). Au-delà de ce
// délai, utiliser le prix du jour pour une session ancienne serait trompeur :
// on bascule alors proprement sur le tarif de secours plutôt que de mentir.
const MAX_RECENT_DAYS = 30

function isRecentEnough(dateStr) {
  if (!dateStr) return true
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return true
  const diffMs = Date.now() - d.getTime()
  return diffMs <= MAX_RECENT_DAYS * 86400000 && diffMs >= -86400000
}

// Détermine le prix carburant à utiliser pour le calcul du gain thermique d'une
// session: moyenne des stations data.gouv.fr autour du point de charge si on a
// des coordonnées GPS ET que la session est récente, sinon le prix de secours
// configuré dans les réglages.
async function resolveFuelPrice(vehicleId, lat, lng, fallbackPrice, dateStr) {
  const fuelType = FUEL_TYPE_BY_VEHICLE[vehicleId] || 'sp95'
  const recent = isRecentEnough(dateStr)
  if (lat && lng && recent) {
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
  return { price: fallbackPrice || 1.85, fuelType, source: recent ? 'manual' : 'manual_old' }
}

module.exports = { getFuelPricesNear, resolveFuelPrice, FUEL_TYPE_BY_VEHICLE }
