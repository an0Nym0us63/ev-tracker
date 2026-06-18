const http = require('http')
const https = require('https')
const db   = require('./db')

// ─── Mapping état HA → vehicleId ──────────────────────────────────────────────
// Hardcodé pour l'instant — pourra devenir configurable plus tard
const STATE_TO_VEHICLE = {
  'mg4':      'mg4',
  'xpeng g6': 'xpeng',
}

function mapStateToVehicle(state) {
  if (!state) return null
  const norm = state.toLowerCase().trim()
  return STATE_TO_VEHICLE[norm] || null
}

// ─── Fetch HA history for an entity between two ISO datetimes ────────────────
function haFetch(haUrl, token, path) {
  return new Promise((resolve, reject) => {
    let url
    try { url = new URL(path, haUrl) } catch(e) { return reject(new Error('URL HA invalide')) }
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 10000,
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

// ─── POST to HA (service calls, e.g. button.press) ───────────────────────────
function haPost(haUrl, token, path, body) {
  return new Promise((resolve, reject) => {
    let url
    try { url = new URL(path, haUrl) } catch(e) { return reject(new Error('URL HA invalide')) }
    const lib = url.protocol === 'https:' ? https : http
    const data = JSON.stringify(body || {})
    const req = lib.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    }, (res) => {
      let resData = ''
      res.on('data', c => resData += c)
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`))
        try { resolve(resData ? JSON.parse(resData) : {}) } catch(e) { resolve({}) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(data)
    req.end()
  })
}

// ─── Get history of an entity between two dates ──────────────────────────────
async function getEntityHistory(haUrl, token, entityId, startIso, endIso) {
  const path = `/api/history/period/${encodeURIComponent(startIso)}?end_time=${encodeURIComponent(endIso)}&filter_entity_id=${encodeURIComponent(entityId)}&minimal_response`
  const result = await haFetch(haUrl, token, path)
  // result is an array of arrays (one per entity) — we filter_entity_id so we expect result[0]
  if (!Array.isArray(result) || !result.length) return []
  return result[0] || []
}

// ─── Determine majority vehicle from state history (weighted by duration) ────
function computeMajorityVehicle(history, startIso, endIso) {
  if (!history.length) return { vehicleId: null, detail: 'Aucun historique HA' }

  const start = new Date(startIso).getTime()
  const end   = new Date(endIso).getTime()
  const durations = {} // vehicleId -> ms

  for (let i = 0; i < history.length; i++) {
    const entry = history[i]
    const entryStart = Math.max(new Date(entry.last_changed).getTime(), start)
    const entryEnd = i + 1 < history.length
      ? Math.min(new Date(history[i+1].last_changed).getTime(), end)
      : end
    if (entryEnd <= entryStart) continue

    const vehicleId = mapStateToVehicle(entry.state)
    if (!vehicleId) continue
    durations[vehicleId] = (durations[vehicleId] || 0) + (entryEnd - entryStart)
  }

  const entries = Object.entries(durations)
  if (!entries.length) return { vehicleId: null, detail: `Aucun état reconnu (états vus: ${[...new Set(history.map(h=>h.state))].join(', ')})` }

  entries.sort((a,b) => b[1] - a[1])
  const [winnerId, winnerMs] = entries[0]
  const totalMs = entries.reduce((s,[,ms])=>s+ms, 0)
  const pct = Math.round(winnerMs / totalMs * 100)

  const detail = entries.map(([id,ms]) => `${id}: ${Math.round(ms/60000)}min`).join(', ')
  return { vehicleId: winnerId, detail: `${detail} → ${winnerId} (${pct}%)` }
}

// ─── Main: detect vehicle for a charge session ────────────────────────────────
async function detectVehicleFromHA(accountId, startIso, endIso) {
  const s = db.prepare('SELECT * FROM settings ORDER BY account_id ASC LIMIT 1').get()
  if (!s?.ha_enabled || !s?.ha_url || !s?.ha_token || !s?.ha_entity_id) {
    return { vehicleId: null, detail: 'HA non configuré ou désactivé' }
  }
  try {
    const history = await getEntityHistory(s.ha_url, s.ha_token, s.ha_entity_id, startIso, endIso)
    return computeMajorityVehicle(history, startIso, endIso)
  } catch(e) {
    return { vehicleId: null, detail: `Erreur HA: ${e.message}` }
  }
}

// ─── Get current state of a single entity (for Live page polling) ────────────
async function getEntityState(haUrl, token, entityId) {
  const path = `/api/states/${encodeURIComponent(entityId)}`
  return haFetch(haUrl, token, path)
}

// ─── Get all states in one call (cheaper than N individual GETs) ─────────────
async function getAllStates(haUrl, token) {
  return haFetch(haUrl, token, '/api/states')
}

// ─── Borne V2C Trydan: entity_ids exposés par l'intégration HA ───────────────
// Hardcodé pour l'instant (une seule borne) — pourra devenir configurable plus tard
const CHARGER_ENTITY_IDS = {
  plugged:       'binary_sensor.v2c_trydan_branche',
  charging:      'binary_sensor.v2c_trydan_charge_en_cours',
  sessionActive: 'binary_sensor.v2c_trydan_session_en_cours',
  status:        'sensor.v2c_trydan_statut',
  powerW:        'sensor.v2c_trydan_puissance_de_charge_2',
  energyKwh:     'sensor.v2c_trydan_energie_de_charge_2',
  duration:      'sensor.v2c_trydan_temps_de_charge_2',
  currentA:      'sensor.v2c_trydan_intensite_de_charge',
  homePowerW:    'sensor.v2c_trydan_puissance_maison',
  solarPowerW:   'sensor.v2c_trydan_puissance_photovoltaique',
  chargeKm:      'sensor.v2c_trydan_v2c_trydan_sensor_chargekm',
}

// ─── Live: état temps réel complet de la borne V2C ────────────────────────────
async function getLiveCharger() {
  const s = db.prepare('SELECT * FROM settings ORDER BY account_id ASC LIMIT 1').get()
  if (!s?.ha_enabled || !s?.ha_url || !s?.ha_token) {
    return { available: false, reason: 'HA non configuré ou désactivé' }
  }
  try {
    const all = await getAllStates(s.ha_url, s.ha_token)
    const map = {}
    for (const e of all) map[e.entity_id] = e

    const raw = (key) => {
      const ent = map[CHARGER_ENTITY_IDS[key]]
      return ent ? ent.state : null
    }
    const num = (key) => {
      const v = raw(key)
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : null
    }

    return {
      available:     true,
      plugged:       raw('plugged') === 'on',
      charging:      raw('charging') === 'on',
      sessionActive: raw('sessionActive') === 'on',
      status:        raw('status'),
      powerW:        num('powerW'),
      energyKwh:     num('energyKwh'),
      duration:      raw('duration'),
      currentA:      num('currentA'),
      homePowerW:    num('homePowerW'),
      solarPowerW:   num('solarPowerW'),
      chargeKm:      num('chargeKm'),
    }
  } catch(e) {
    return { available: false, reason: `Erreur HA: ${e.message}` }
  }
}

// ─── Live: current vehicle plugged in, from the same entity used for detection ─
async function getLiveVehicle() {
  const s = db.prepare('SELECT * FROM settings ORDER BY account_id ASC LIMIT 1').get()
  if (!s?.ha_enabled || !s?.ha_url || !s?.ha_token || !s?.ha_entity_id) {
    return { available: false, reason: 'HA non configuré ou désactivé' }
  }
  try {
    const state = await getEntityState(s.ha_url, s.ha_token, s.ha_entity_id)
    const vehicleId = mapStateToVehicle(state.state)
    return {
      available: true,
      rawState: state.state,
      vehicleId,
      lastChanged: state.last_changed,
      lastUpdated: state.last_updated,
    }
  } catch(e) {
    return { available: false, reason: `Erreur HA: ${e.message}` }
  }
}

// ─── Live: historique de puissance de la session de charge en cours ──────────
// Reconstruit le graphe complet même si la page Live a été ouverte après le
// début de la charge, en s'appuyant sur l'historique HA du capteur de puissance
// depuis le dernier changement d'état de "charge en cours".
async function getSessionPowerHistory() {
  const s = db.prepare('SELECT * FROM settings ORDER BY account_id ASC LIMIT 1').get()
  if (!s?.ha_enabled || !s?.ha_url || !s?.ha_token) {
    return { available: false, reason: 'HA non configuré ou désactivé' }
  }
  try {
    const all = await getAllStates(s.ha_url, s.ha_token)
    const map = {}
    for (const e of all) map[e.entity_id] = e

    const chargingEnt = map[CHARGER_ENTITY_IDS.charging]
    if (!chargingEnt || chargingEnt.state !== 'on') {
      return { available: false, reason: 'Aucune charge en cours' }
    }

    // Calcule le vrai début de session depuis le sensor de durée V2C.
    // last_changed du binary_sensor n'est pas fiable : il se réinitialise si HA
    // redémarre ou si l'entité connaît une micro-coupure, ce qui fait croire que
    // la session a démarré récemment alors qu'elle tourne depuis des heures.
    // Le sensor durée peut retourner soit un nombre de secondes, soit "HH:MM:SS".
    let sessionStart
    const durationEnt = map[CHARGER_ENTITY_IDS.duration]
    let durationSec = NaN
    if (durationEnt) {
      const raw = durationEnt.state
      if (/^\d+(\.\d+)?$/.test(raw)) {
        // Valeur numérique brute (secondes)
        durationSec = parseFloat(raw)
      } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
        // Format "H:MM:SS" ou "H:MM"
        const parts = raw.split(':').map(Number)
        if (parts.length === 3) durationSec = parts[0]*3600 + parts[1]*60 + parts[2]
        else if (parts.length === 2) durationSec = parts[0]*3600 + parts[1]*60
      }
    }
    if (Number.isFinite(durationSec) && durationSec > 0) {
      sessionStart = new Date(Date.now() - durationSec * 1000).toISOString()
    } else {
      // Fallback : last_changed du binary_sensor
      sessionStart = chargingEnt.last_changed
    }
    const history = await getEntityHistory(s.ha_url, s.ha_token, CHARGER_ENTITY_IDS.powerW, sessionStart, new Date().toISOString())
    const points = history
      .map(e => ({ t: e.last_changed, w: parseFloat(e.state) }))
      .filter(p => Number.isFinite(p.w))

    return { available: true, sessionStart, points }
  } catch(e) {
    return { available: false, reason: `Erreur HA: ${e.message}` }
  }
}

// ─── Infos véhicule (Enode) — par véhicule, même schéma pour MG4 plus tard ────
// Pour l'instant seul Xpeng G6 est câblé. "refresh" presse le bouton HA qui
// déclenche un rafraîchissement Enode (les données vivantes sont parfois figées
// tant qu'on ne le demande pas explicitement) — pressé en one-shot à l'arrivée
// sur la page Live côté client, pas à chaque poll de 5s.
const VEHICLE_ENTITY_IDS = {
  xpeng: {
    battery:       'sensor.xpeng_g6_battery_level',
    pluggedIn:     'binary_sensor.xpeng_g6_plugged_in',
    powerState:    'sensor.xpeng_g6_power_delivery_state',
    range:         'sensor.xpeng_g6_range',
    location:      'device_tracker.xpeng_g6_location',
    refreshButton: 'button.xpeng_g6_refresh_data',
  },
  mg4: {
    battery:    'sensor.lsjwh4098pn226047_soc',
    pluggedIn:  'binary_sensor.lsjwh4098pn226047_charger_connected',
    charging:   'binary_sensor.lsjwh4098pn226047_battery_charging',
    range:      'sensor.lsjwh4098pn226047_range',
    location:   'device_tracker.lsjwh4098pn226047_vehicle_position',
    refreshSelect: { entityId: 'select.lsjwh4098pn226047_gateway_refresh_mode', option: 'force' },
  },
}

async function getVehicleStatus(vehicleId) {
  const s = db.prepare('SELECT * FROM settings ORDER BY account_id ASC LIMIT 1').get()
  if (!s?.ha_enabled || !s?.ha_url || !s?.ha_token) {
    return { available: false, reason: 'HA non configuré ou désactivé' }
  }
  const ids = VEHICLE_ENTITY_IDS[vehicleId]
  if (!ids) return { available: false, reason: 'Véhicule non câblé' }
  try {
    const all = await getAllStates(s.ha_url, s.ha_token)
    const map = {}
    for (const e of all) map[e.entity_id] = e

    const raw = (key) => { const ent = map[ids[key]]; return ent ? ent.state : null }
    const num = (key) => { const n = parseFloat(raw(key)); return Number.isFinite(n) ? n : null }
    // device_tracker: state = zone ("home"/"not_home"/...), GPS dans attributes
    const locEnt = map[ids.location]
    const lat = locEnt?.attributes?.latitude ?? null
    const lng = locEnt?.attributes?.longitude ?? null

    return {
      available:          true,
      batteryLevel:        num('battery'),
      pluggedIn:           ids.pluggedIn  ? raw('pluggedIn') === 'on' : null,
      charging:            ids.charging   ? raw('charging')  === 'on' : null,
      powerDeliveryState:  ids.powerState ? raw('powerState') : null,
      rangeKm:             num('range'),
      lat, lng,
      locationZone:        raw('location'),
    }
  } catch(e) {
    return { available: false, reason: `Erreur HA: ${e.message}` }
  }
}

async function refreshVehicleData(vehicleId) {
  const s = db.prepare('SELECT * FROM settings ORDER BY account_id ASC LIMIT 1').get()
  if (!s?.ha_enabled || !s?.ha_url || !s?.ha_token) {
    return { ok: false, reason: 'HA non configuré ou désactivé' }
  }
  const ids = VEHICLE_ENTITY_IDS[vehicleId]
  if (!ids) return { ok: false, reason: 'Véhicule non câblé' }
  try {
    if (ids.refreshButton) {
      await haPost(s.ha_url, s.ha_token, '/api/services/button/press', { entity_id: ids.refreshButton })
      return { ok: true }
    }
    if (ids.refreshService) {
      // { domain:'saic_ismart', service:'force_refresh', data:{...} } par ex.
      const { domain, service, data } = ids.refreshService
      await haPost(s.ha_url, s.ha_token, `/api/services/${domain}/${service}`, data || {})
      return { ok: true }
    }
    if (ids.refreshSelect) {
      // Cas MG4 (intégration SAIC iSmart) : pas de bouton ni de service dédié,
      // juste un select "mode de rafraîchissement" dont une des options force
      // une remontée de données fraîches.
      const { entityId, option } = ids.refreshSelect
      await haPost(s.ha_url, s.ha_token, '/api/services/select/select_option', { entity_id: entityId, option })
      return { ok: true }
    }
    return { ok: false, reason: 'Pas de rafraîchissement configuré pour ce véhicule' }
  } catch(e) {
    return { ok: false, reason: `Erreur HA: ${e.message}` }
  }
}

module.exports = { detectVehicleFromHA, computeMajorityVehicle, mapStateToVehicle, getEntityState, getLiveVehicle, getLiveCharger, getSessionPowerHistory, getVehicleStatus, refreshVehicleData }
