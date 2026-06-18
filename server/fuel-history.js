const https = require('https')
const unzipper = require('unzipper')

// ─── Outil TEMPORAIRE — recalcul one-shot de l'historique des prix carburant ──
// L'API "flux instantané" ne donne que le prix du moment (voir fuel.js). Pour
// aligner une bonne fois pour toutes les sessions anciennes sur un prix
// historiquement cohérent, on télécharge l'archive annuelle officielle
// (https://donnees.roulez-eco.fr/opendata/annee/{année}), qui contient — selon
// la doc officielle data.gouv.fr — l'historique des prix de toutes les
// journées de l'année. On en extrait, par station, la liste des changements
// de prix (date + valeur) par carburant, pour pouvoir retrouver le prix en
// vigueur à une date donnée. Une fois ce rattrapage fait, chaque nouvelle
// session utilise le prix du moment (fuel.js) — ce module n'a plus de rôle
// après le one-shot et peut être supprimé.

const yearIndexCache = new Map() // year -> stations[]

function httpGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ev-tracker' } }, (r) => {
      if (r.statusCode === 404) return reject(Object.assign(new Error('404'), { code: 404 }))
      if (r.statusCode !== 200) return reject(new Error(`HTTP ${r.statusCode}`))
      const chunks = []
      r.on('data', c => chunks.push(c))
      r.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.setTimeout(120000, () => req.destroy(new Error('Timeout téléchargement archive annuelle')))
  })
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2-lat1) * Math.PI/180
  const dLng = (lng2-lng1) * Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Parsing volontairement en regex (pas de DOM XML complet) : le fichier annuel
// fait plusieurs centaines de Mo décompressé, un parseur DOM serait trop
// lourd. La structure est plate et stable :
// <pdv id="..." latitude="..." longitude="..." ...>...<prix nom="Gazole" maj="2024-03-02 09:00:00" valeur="1.789"/>...</pdv>
function parseAnnualXml(xml) {
  const stations = []
  const pdvRe = /<pdv\s+([^>]*)>([\s\S]*?)<\/pdv>/g
  const attrRe = (attrs, name) => {
    const m = new RegExp(`${name}="([^"]*)"`).exec(attrs)
    return m ? m[1] : null
  }
  const prixRe = /<prix\s+([^>]*?)\/?>/g

  let m
  while ((m = pdvRe.exec(xml)) !== null) {
    const [, attrs, body] = m
    const latRaw = attrRe(attrs, 'latitude')
    const lngRaw = attrRe(attrs, 'longitude')
    if (!latRaw || !lngRaw) continue
    const lat = parseFloat(latRaw) / 100000
    const lng = parseFloat(lngRaw) / 100000
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) continue

    const prices = {} // fuelLower -> [{date, value}]
    let p
    prixRe.lastIndex = 0
    while ((p = prixRe.exec(body)) !== null) {
      const pattrs = p[1]
      const nom = attrRe(pattrs, 'nom')
      const maj = attrRe(pattrs, 'maj')
      const valeur = attrRe(pattrs, 'valeur')
      if (!nom || !maj || !valeur) continue
      const v = parseFloat(valeur)
      if (!Number.isFinite(v) || v <= 0) continue
      const fuel = nom.toLowerCase()
      if (fuel !== 'gazole' && fuel !== 'sp95') continue
      const date = maj.slice(0, 10) // YYYY-MM-DD
      if (!prices[fuel]) prices[fuel] = []
      prices[fuel].push({ date, value: v })
    }
    if (prices.gazole || prices.sp95) {
      for (const k of Object.keys(prices)) prices[k].sort((a,b) => a.date < b.date ? -1 : 1)
      stations.push({ lat, lng, prices })
    }
  }
  return stations
}

// Télécharge + parse l'archive annuelle pour une année donnée (avec cache mémoire
// pour la durée du process, vu le coût du téléchargement/parsing).
async function getYearIndex(year) {
  if (yearIndexCache.has(year)) return yearIndexCache.get(year)

  const currentYear = new Date().getFullYear()
  const urls = year === currentYear
    ? [`https://donnees.roulez-eco.fr/opendata/annee/${year}`, `https://donnees.roulez-eco.fr/opendata/annee`]
    : [`https://donnees.roulez-eco.fr/opendata/annee/${year}`]

  let buffer = null
  let lastErr = null
  for (const url of urls) {
    try { buffer = await httpGetBuffer(url); break } catch(e) { lastErr = e }
  }
  if (!buffer) throw lastErr || new Error(`Archive ${year} introuvable`)

  const directory = await unzipper.Open.buffer(buffer)
  const xmlEntry = directory.files.find(f => /\.xml$/i.test(f.path))
  if (!xmlEntry) throw new Error(`Aucun XML trouvé dans l'archive ${year}`)
  const xmlBuffer = await xmlEntry.buffer()
  const stations = parseAnnualXml(xmlBuffer.toString('utf8'))

  yearIndexCache.set(year, stations)
  return stations
}

// Pour une station, retrouve le dernier prix connu À LA DATE DONNÉE (le prix
// reste valable jusqu'au changement suivant). Retourne null si la station n'a
// aucun relevé à cette date ou avant.
function priceAtDate(station, fuelType, dateStr) {
  const list = station.prices[fuelType]
  if (!list || !list.length) return null
  let best = null
  for (const entry of list) {
    if (entry.date <= dateStr) best = entry
    else break // trié croissant : on peut s'arrêter
  }
  return best ? best.value : null
}

// Moyenne historique des stations à proximité d'un point, à une date donnée.
// Élargit progressivement le rayon (comme la recherche temps réel) si besoin.
async function getHistoricalAverage(stations, lat, lng, dateStr, fuelType) {
  const radii = [15, 30, 60, 100]
  for (const km of radii) {
    const found = []
    for (const s of stations) {
      if (Math.abs(s.lat - lat) > 1.5 || Math.abs(s.lng - lng) > 1.5) continue // filtre grossier avant haversine
      if (haversineKm(lat, lng, s.lat, s.lng) > km) continue
      const price = priceAtDate(s, fuelType, dateStr)
      if (price !== null) found.push(price)
      if (found.length >= 5) break // 5 stations suffisent pour une moyenne stable
    }
    if (found.length >= 1) {
      const avg = found.reduce((a,b) => a+b, 0) / found.length
      return { price: Math.round(avg * 1000) / 1000, stationCount: found.length, radiusKm: km }
    }
  }
  return null
}

module.exports = { getYearIndex, getHistoricalAverage }
