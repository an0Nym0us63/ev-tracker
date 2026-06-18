import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import ProfileMenu from '../components/ProfileMenu.jsx'
import { apiGetLiveVehicle, apiGetLiveCharger, apiGetSessionPower, apiGetVehicleStatus, apiRefreshVehicleData } from '../api.js'
import { VEHICLES } from '../utils.js'

const POLL_INTERVAL_MS = 5000

const TILE_LAYERS = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
}
function loadLeaflet() {
  return new Promise(resolve => {
    if (window.L) { resolve(); return }
    const link = document.createElement('link')
    link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload=resolve; document.head.appendChild(script)
  })
}

const STATUS_MAP = {
  charging:             { label: 'En charge',           color: 'var(--green)' },
  connected:            { label: 'Branché, prêt',       color: 'var(--accent)' },
  waiting_solar:        { label: 'Attente surplus PV',  color: 'var(--amber)' },
  session_waiting:      { label: 'Session en attente',  color: 'var(--amber)' },
  paused:               { label: 'Pause manuelle',      color: 'var(--amber)' },
  stop_mode:            { label: 'En mode arrêt',       color: 'var(--muted)' },
  unplugged:            { label: 'Débranché',           color: 'var(--muted)' },
  locked:               { label: 'Verrouillé',          color: 'var(--muted)' },
  ventilation_required: { label: 'Ventilation requise', color: 'var(--red)' },
  fault:                { label: 'Défaut système',      color: 'var(--red)' },
  error:                { label: 'Erreur (terre)',      color: 'var(--red)' },
  unknown:              { label: 'Inconnu',             color: 'var(--muted)' },
}

function statusInfo(raw) {
  if (!raw) return { label: '—', color: 'var(--muted)' }
  const known = STATUS_MAP[raw.toLowerCase()]
  if (known) return known
  return { label: raw.charAt(0).toUpperCase() + raw.slice(1), color: 'var(--muted)' }
}

function fmtKw(w) {
  if (w === null || w === undefined) return '—'
  return (w / 1000).toFixed(1)
}

function fmtTime(t) {
  return new Date(t).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
}

// Jauge circulaire de puissance — élément central de la page : c'est la donnée
// la plus "vivante" (change en direct), donc le point focal naturel du design.
function PowerGauge({ valueKw, maxKw, color, statusLabel, sublabel, pulsing }) {
  const size = 188, r = 78, strokeW = 13
  const C = 2 * Math.PI * r
  const pct = maxKw > 0 ? Math.min(Math.max((valueKw||0) / maxKw, 0), 1) : 0
  const offset = C * (1 - pct)
  return (
    <div style={{ position:'relative', width:size, height:size, margin:'4px auto 0' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:'stroke-dashoffset 0.7s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div className="mono" style={{ fontSize:32, fontWeight:700, color:'var(--text)', lineHeight:1 }}>
          {valueKw != null ? valueKw.toFixed(1) : '—'}
        </div>
        <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600, letterSpacing:'0.05em', marginTop:1 }}>kW</div>
        {statusLabel && (
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:9 }}>
            {pulsing && <span className="live-dot" style={{ '--pulse-color': `${color}80`, width:6, height:6, borderRadius:'50%', background:color, animation:'livePulse 2s infinite' }} />}
            <span style={{ fontSize:11.5, fontWeight:700, color }}>{statusLabel}</span>
          </div>
        )}
        {sublabel && <div style={{ fontSize:10.5, color:'var(--muted)', marginTop:3, maxWidth:size-40, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sublabel}</div>}
      </div>
    </div>
  )
}

function StatRow({ label, value, unit, color, divider=true }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'10px 0', borderBottom: divider ? '1px solid var(--border)' : 'none' }}>
      <span style={{ fontSize:12.5, color:'var(--muted)' }}>{label}</span>
      <span className="mono" style={{ fontSize:15, fontWeight:700, color: color || 'var(--text)' }}>
        {value}{unit && <span style={{ fontSize:10.5, color:'var(--muted)', fontWeight:400, marginLeft:3 }}>{unit}</span>}
      </span>
    </div>
  )
}

// Pastille branché / en charge — remplace deux lignes de texte par un seul repère visuel.
function ChargeBadge({ charging, pluggedIn }) {
  let icon, label, color
  if (charging)        { icon = '⚡'; label = 'En charge'; color = 'var(--green)' }
  else if (pluggedIn)  { icon = '🔌'; label = 'Branché';   color = 'var(--amber)' }
  else                 { icon = '🔌'; label = 'Débranché'; color = 'var(--muted)' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color, background:`${color}1a`, padding:'4px 10px', borderRadius:20 }}>
      {charging && <span style={{ width:5, height:5, borderRadius:'50%', background:color, animation:'livePulse 2s infinite', '--pulse-color':`${color}80` }} />}
      {icon} {label}
    </span>
  )
}

// Barre de batterie — pourcentage écrit dans (ou juste après, si trop étroit) la barre.
function BatteryBar({ pct, color, charging, pluggedIn }) {
  if (pct == null) return <div style={{ fontSize:11.5, color:'var(--muted)' }}>Batterie inconnue</div>
  const clamped = Math.min(Math.max(pct, 0), 100)
  const textInside = clamped > 16
  return (
    <div style={{ position:'relative', height:26, borderRadius:8, background:'var(--surface2)', overflow:'hidden' }}>
      <div style={{ position:'relative', height:'100%', width:`${clamped}%`, background:color, transition:'width 0.6s ease', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight: textInside ? 8 : 0, boxSizing:'border-box', overflow:'hidden' }}>
        {/* En charge : hachures qui défilent, façon batterie qui se remplit */}
        {charging && (
          <div style={{ position:'absolute', inset:0,
            background:'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 6px, transparent 6px, transparent 16px)',
            backgroundSize:'32px 100%', animation:'batteryChargeStripes 0.9s linear infinite' }} />
        )}
        {/* Branché sans charger : halo qui respire doucement */}
        {pluggedIn && !charging && (
          <div style={{ position:'absolute', inset:0, background:'#fff', animation:'batteryPlugGlow 2.4s ease-in-out infinite' }} />
        )}
        {textInside && <span className="mono" style={{ position:'relative', fontSize:12, fontWeight:700, color:'#fff' }}>{clamped}%</span>}
      </div>
      {!textInside && (
        <span className="mono" style={{ position:'absolute', left:8, top:0, height:'100%', display:'flex', alignItems:'center', fontSize:12, fontWeight:700, color:'var(--text)' }}>{clamped}%</span>
      )}
    </div>
  )
}

// Carte véhicule compacte : nom + statut, barre de batterie + autonomie accolée
// sur la même ligne (au lieu d'une ligne dédiée juste pour un chiffre).
function VehicleCard({ vehicle, status, charging }) {
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14 }}>{vehicle.emoji}</span>
          <span style={{ fontSize:12.5, fontWeight:700, color:vehicle.color }}>{vehicle.name}</span>
        </div>
        <ChargeBadge charging={charging} pluggedIn={status.pluggedIn} />
      </div>
      <div style={{ display:'flex', alignItems:'stretch', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <BatteryBar pct={status.batteryLevel} color={vehicle.color} charging={charging} pluggedIn={status.pluggedIn} />
        </div>
        {status.rangeKm != null && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 10px', borderRadius:8, background:'var(--surface2)', flexShrink:0 }}>
            <span className="mono" style={{ fontSize:11.5, fontWeight:700, color:'var(--text)', lineHeight:1.1 }}>{status.rangeKm}</span>
            <span style={{ fontSize:7.5, color:'var(--muted)', fontWeight:600, letterSpacing:'0.03em' }}>KM</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Live({ account, settings, onLogout, theme, onToggleTheme, onNavigate }) {
  const [vehicleData, setVehicleData] = useState(null)
  const [chargerData, setChargerData] = useState(null)
  const [xpengStatus, setXpengStatus] = useState(null)
  const [mg4Status, setMg4Status] = useState(null)
  const [powerHistory, setPowerHistory] = useState([])  // [{ t: ms, kw: number }]
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)
  const wasChargingRef = useRef(false)

  // Carte de localisation (Domicile + Xpeng pour l'instant, MG4 suivra)
  const [leafletReady, setLeafletReady] = useState(false)
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const tileRef = useRef(null)
  useEffect(() => { loadLeaflet().then(() => setLeafletReady(true)) }, [])

  const fetchLive = useCallback(async () => {
    try {
      const [v, c] = await Promise.all([apiGetLiveVehicle(), apiGetLiveCharger()])
      setVehicleData(v)
      setChargerData(c)
      setError(null)

      const nowCharging = !!(c?.available && c.charging)
      if (nowCharging) {
        if (!wasChargingRef.current) {
          // Nouvelle session (ou page ouverte en cours de charge) : on récupère
          // l'historique complet depuis HA pour reconstruire le graphe entier.
          try {
            const hist = await apiGetSessionPower()
            if (hist?.available) {
              setPowerHistory(hist.points.map(p => ({ t: new Date(p.t).getTime(), kw: p.w / 1000 })))
            } else {
              setPowerHistory([])
            }
          } catch { setPowerHistory([]) }
        } else if (c.powerW != null) {
          // Session déjà en cours : on ajoute juste le point courant, pas de
          // nouvel appel d'historique HA à chaque poll.
          setPowerHistory(prev => [...prev, { t: Date.now(), kw: c.powerW / 1000 }])
        }
      }
      wasChargingRef.current = nowCharging
    } catch (e) {
      setError(e.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }

    // Indépendant du reste : une panne ici ne doit pas casser l'affichage borne/véhicule.
    try {
      setXpengStatus(await apiGetVehicleStatus('xpeng'))
    } catch { setXpengStatus({ available: false, reason: 'Erreur de connexion' }) }
    try {
      setMg4Status(await apiGetVehicleStatus('mg4'))
    } catch { setMg4Status({ available: false, reason: 'Erreur de connexion' }) }
  }, [])

  // Engine: fetch immediately, then poll every 5s. Pause when tab/app is hidden
  // to avoid useless calls, resume + refresh immediately when it becomes visible again.
  useEffect(() => {
    fetchLive()
    intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS)

    // One-shot à l'arrivée sur la page : on demande aux intégrations véhicule de
    // rafraîchir leurs données. Fire-and-forget — le poll de 5s déjà en cours
    // affichera la valeur mise à jour dès que HA l'aura reçue. Pour MG4, ok:false
    // tant que le mécanisme de refresh n'est pas confirmé (pas bloquant).
    apiRefreshVehicleData('xpeng').catch(() => {})
    apiRefreshVehicleData('mg4').catch(() => {})

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchLive()
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS)
      } else {
        clearInterval(intervalRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchLive])

  const vehicle = vehicleData?.vehicleId ? VEHICLES[vehicleData.vehicleId] : null
  const st = statusInfo(chargerData?.status)
  const nothingConfigured = vehicleData && chargerData && !vehicleData.available && !chargerData.available

  // Jauge : échelle 0→max, max par défaut 7.4kW (AC monophasé standard du V2C
  // Trydan) mais s'élargit automatiquement si une puissance plus élevée est
  // observée, pour ne jamais saturer visuellement à 100% à tort.
  const currentKw = chargerData?.powerW != null ? chargerData.powerW/1000 : null
  const maxObservedKw = powerHistory.length ? Math.max(...powerHistory.map(p=>p.kw)) : 0
  const gaugeMaxKw = Math.max(7.4, maxObservedKw, currentKw||0)
  const gaugeSublabel = vehicle ? vehicle.name : (chargerData?.plugged ? 'Véhicule branché' : null)

  // Carte : Domicile (réglages) + Xpeng (Enode), MG4 suivra le même schéma
  const mapStyle = theme === 'light' ? 'light' : 'dark'
  const homeLat = settings?.homeLat, homeLng = settings?.homeLng
  const xpengLat = xpengStatus?.lat, xpengLng = xpengStatus?.lng
  const mg4Lat = mg4Status?.lat, mg4Lng = mg4Status?.lng
  const hasMapData = !!((homeLat && homeLng) || (xpengLat && xpengLng) || (mg4Lat && mg4Lng))

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !hasMapData) return
    if (!mapInst.current) {
      mapInst.current = window.L.map(mapRef.current, { zoomControl:false, attributionControl:false }).setView([46.8,2.3], 6)
    }
    const map = mapInst.current
    if (tileRef.current) map.removeLayer(tileRef.current)
    tileRef.current = window.L.tileLayer(TILE_LAYERS[mapStyle]||TILE_LAYERS.dark, { maxZoom:19 }).addTo(map)

    map.eachLayer(l => { if (l instanceof window.L.Marker) map.removeLayer(l) })
    const bounds = []
    if (homeLat && homeLng) {
      const icon = window.L.divIcon({ html:`<div style="width:32px;height:32px;border-radius:50%;background:#22c55e;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠</div>`, className:'', iconSize:[32,32], iconAnchor:[16,16] })
      window.L.marker([homeLat, homeLng], { icon, zIndexOffset:0 }).addTo(map).bindPopup('<b>Domicile</b>')
      bounds.push([homeLat, homeLng])
    }
    if (xpengLat && xpengLng) {
      const icon = window.L.divIcon({ html:`<div style="width:32px;height:32px;border-radius:50%;background:#7c5cfc;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🚙</div>`, className:'', iconSize:[32,32], iconAnchor:[16,16] })
      window.L.marker([xpengLat, xpengLng], { icon, zIndexOffset:1000 }).addTo(map).bindPopup('<b>Xpeng G6</b>')
      bounds.push([xpengLat, xpengLng])
    }
    if (mg4Lat && mg4Lng) {
      const icon = window.L.divIcon({ html:`<div style="width:32px;height:32px;border-radius:50%;background:#4f8ef7;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🚗</div>`, className:'', iconSize:[32,32], iconAnchor:[16,16] })
      window.L.marker([mg4Lat, mg4Lng], { icon, zIndexOffset:1000 }).addTo(map).bindPopup('<b>MG4</b>')
      bounds.push([mg4Lat, mg4Lng])
    }
    if (bounds.length === 1) map.setView(bounds[0], 15)
    else if (bounds.length > 1) map.fitBounds(bounds, { padding:[30,30], maxZoom:15 })
  }, [leafletReady, mapStyle, homeLat, homeLng, xpengLat, xpengLng, mg4Lat, mg4Lng, hasMapData])

  useEffect(() => () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }, [])

  return (
    <div className="page fade-up" style={{ paddingBottom:100, minHeight:'100dvh' }}>
      <div style={{ padding:'16px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Live</div>
        <ProfileMenu account={account} onNavigate={onNavigate} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      </div>

      <div style={{ padding:'16px 16px 0', display:'flex', flexDirection:'column', gap:10 }}>

        {loading && (
          <div className="card" style={{ padding:'30px 16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
            Connexion à Home Assistant…
          </div>
        )}

        {!loading && error && (
          <div className="card" style={{ padding:'20px 16px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Connexion impossible</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{error}</div>
          </div>
        )}

        {!loading && !error && nothingConfigured && (
          <div className="card" style={{ padding:'20px 16px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔌</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Home Assistant non configuré</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{chargerData.reason || vehicleData.reason}</div>
          </div>
        )}

        {!loading && !error && !nothingConfigured && (
          <>
            {/* Statut borne + jauge de puissance — élément central de la page */}
            <div className="card" style={{ padding:'16px 16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Borne V2C Trydan
                </div>
                {vehicle && (
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:14 }}>{vehicle.emoji}</span>
                    <span style={{ fontSize:11.5, fontWeight:700, color:vehicle.color }}>{vehicle.name}</span>
                  </div>
                )}
              </div>

              {chargerData?.available ? (
                <>
                  <PowerGauge
                    valueKw={currentKw}
                    maxKw={gaugeMaxKw}
                    color={st.color}
                    statusLabel={st.label}
                    sublabel={gaugeSublabel}
                    pulsing={chargerData.charging}
                  />
                  {chargerData.chargeKm != null && chargerData.chargeKm > 0 && (
                    <div style={{ textAlign:'center', marginTop:12 }}>
                      <span style={{ fontSize:11, color:'var(--green)', background:'var(--green-dim)', padding:'4px 10px', borderRadius:20, fontWeight:600 }}>
                        +{chargerData.chargeKm.toFixed(1)} km gagnés cette session
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:10, textAlign:'center' }}>{chargerData?.reason}</div>
              )}
            </div>

            {/* Graphe de puissance de la session en cours */}
            {chargerData?.available && chargerData.charging && powerHistory.length > 1 && (
              <div className="card" style={{ padding:'14px 14px 4px' }}>
                <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                  Puissance — session en cours
                </div>
                <div style={{ width:'100%', height:120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={powerHistory} margin={{ top:6, right:6, left:-22, bottom:0 }}>
                      <defs>
                        <linearGradient id="livePowerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={st.color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={st.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']} tickFormatter={fmtTime}
                        tick={{ fontSize:9, fill:'var(--muted)' }} axisLine={false} tickLine={false} minTickGap={50} />
                      <YAxis tick={{ fontSize:9, fill:'var(--muted)' }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        formatter={(v)=>[`${v.toFixed(1)} kW`, 'Puissance']}
                        labelFormatter={(t)=> new Date(t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                        contentStyle={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}
                      />
                      <Area type="monotone" dataKey="kw" stroke={st.color} strokeWidth={2} fill="url(#livePowerGrad)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Détails — liste épurée plutôt que des cartes séparées */}
            {chargerData?.available && (
              <div className="card" style={{ padding:'2px 16px' }}>
                <StatRow label="🔋 Énergie session" value={chargerData.energyKwh != null ? chargerData.energyKwh.toFixed(2) : '—'} unit="kWh" color="var(--green)" />
                <StatRow label="⏱️ Durée session" value={chargerData.duration || '—'} />
                <StatRow label="⚡ Intensité" value={chargerData.currentA ?? '—'} unit="A" />
                <StatRow label="🏠 Puissance maison" value={fmtKw(chargerData.homePowerW)} unit="kW" divider={false} />
              </div>
            )}

            {/* Infos véhicule (Enode / SAIC) — carte compacte : statut + jauge batterie + autonomie */}
            {xpengStatus?.available && (
              <VehicleCard
                vehicle={VEHICLES.xpeng}
                status={xpengStatus}
                charging={(xpengStatus.powerDeliveryState || '').toLowerCase() === 'charging'}
              />
            )}

            {mg4Status?.available && (
              <VehicleCard
                vehicle={VEHICLES.mg4}
                status={mg4Status}
                charging={mg4Status.charging === true}
              />
            )}

            {/* Carte de localisation — Domicile + Xpeng + MG4 */}
            {hasMapData && (
              <div className="card" style={{ padding:'14px 14px 12px' }}>
                <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                  Localisation
                </div>
                <div style={{ position:'relative', height:280, borderRadius:'var(--r-sm)', overflow:'hidden', border:'1px solid var(--border)' }}>
                  {!leafletReady ? (
                    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface2)', color:'var(--muted)', fontSize:12 }}>Chargement…</div>
                  ) : (
                    <div ref={mapRef} style={{ width:'100%', height:'100%', touchAction:'none', overscrollBehavior:'contain' }} />
                  )}
                </div>
              </div>
            )}

            <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:4 }}>
              Actualisé automatiquement toutes les 5 secondes
            </div>
          </>
        )}

      </div>
    </div>
  )
}
