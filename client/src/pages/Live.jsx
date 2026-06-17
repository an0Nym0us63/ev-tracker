import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import ProfileMenu from '../components/ProfileMenu.jsx'
import { apiGetLiveVehicle, apiGetLiveCharger, apiGetSessionPower } from '../api.js'
import { VEHICLES } from '../utils.js'

const POLL_INTERVAL_MS = 5000

const STATUS_MAP = {
  charging:     { label: 'En charge',   color: 'var(--green)',  dot: true },
  paused:       { label: 'En pause',    color: 'var(--amber)',  dot: false },
  ready:        { label: 'Prêt',        color: 'var(--accent)', dot: false },
  disconnected: { label: 'Déconnecté',  color: 'var(--muted)',  dot: false },
  error:        { label: 'Erreur',      color: 'var(--red)',    dot: false },
  scheduled:    { label: 'Programmé',   color: 'var(--accent)', dot: false },
}

function statusInfo(raw) {
  if (!raw) return { label: '—', color: 'var(--muted)', dot: false }
  const known = STATUS_MAP[raw.toLowerCase()]
  if (known) return known
  return { label: raw.charAt(0).toUpperCase() + raw.slice(1), color: 'var(--muted)', dot: false }
}

function fmtKw(w) {
  if (w === null || w === undefined) return '—'
  return (w / 1000).toFixed(1)
}

function fmtTime(t) {
  return new Date(t).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
}

function Kpi({ label, value, unit, color }) {
  return (
    <div className="card" style={{ padding:'12px 12px' }}>
      <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize:18, fontWeight:700, color: color || 'var(--text)' }}>
        {value}{unit && <span style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}> {unit}</span>}
      </div>
    </div>
  )
}

export default function Live({ account, onLogout, theme, onToggleTheme, onNavigate }) {
  const [vehicleData, setVehicleData] = useState(null)
  const [chargerData, setChargerData] = useState(null)
  const [powerHistory, setPowerHistory] = useState([])  // [{ t: ms, kw: number }]
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)
  const wasChargingRef = useRef(false)

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
  }, [])

  // Engine: fetch immediately, then poll every 5s. Pause when tab/app is hidden
  // to avoid useless calls, resume + refresh immediately when it becomes visible again.
  useEffect(() => {
    fetchLive()
    intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS)

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
            {/* Statut borne + véhicule branché */}
            <div className="card" style={{ padding:'16px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Borne V2C Trydan
                </div>
                {chargerData?.available && (
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {st.dot && <span style={{ width:7, height:7, borderRadius:'50%', background:st.color, display:'inline-block', boxShadow:`0 0 8px ${st.color}` }} />}
                    <span style={{ fontSize:12, fontWeight:700, color:st.color }}>{st.label}</span>
                  </div>
                )}
              </div>

              {chargerData?.available ? (
                <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12 }}>
                  <span style={{ fontSize:32 }}>{vehicle ? vehicle.emoji : '🔌'}</span>
                  <div>
                    {vehicle ? (
                      <div style={{ fontSize:17, fontWeight:700, color:vehicle.color }}>{vehicle.name}</div>
                    ) : (
                      <div style={{ fontSize:15, fontWeight:600, color:'var(--muted)' }}>
                        {chargerData.plugged ? 'Véhicule branché' : 'Aucun véhicule branché'}
                      </div>
                    )}
                    {chargerData.chargeKm != null && chargerData.chargeKm > 0 && (
                      <div style={{ fontSize:11, color:'var(--green)', marginTop:2 }}>+{chargerData.chargeKm.toFixed(1)} km gagnés cette session</div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>{chargerData?.reason}</div>
              )}
            </div>

            {/* Graphe de puissance de la session en cours */}
            {chargerData?.available && chargerData.charging && powerHistory.length > 1 && (
              <div className="card" style={{ padding:'14px 14px 4px' }}>
                <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                  Puissance — session en cours
                </div>
                <div style={{ width:'100%', height:130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={powerHistory} margin={{ top:6, right:6, left:-22, bottom:0 }}>
                      <defs>
                        <linearGradient id="livePowerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
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
                      <Area type="monotone" dataKey="kw" stroke="var(--accent)" strokeWidth={2} fill="url(#livePowerGrad)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* KPIs borne en temps réel */}
            {chargerData?.available && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Kpi label="Puissance de charge" value={fmtKw(chargerData.powerW)} unit="kW" color="var(--accent)" />
                <Kpi label="Intensité" value={chargerData.currentA ?? '—'} unit="A" />
                <Kpi label="Énergie session" value={chargerData.energyKwh != null ? chargerData.energyKwh.toFixed(2) : '—'} unit="kWh" color="var(--green)" />
                <Kpi label="Durée session" value={chargerData.duration || '—'} />
                <Kpi label="Puissance maison" value={fmtKw(chargerData.homePowerW)} unit="kW" />
                <Kpi label="Puissance solaire" value={fmtKw(chargerData.solarPowerW)} unit="kW" color="var(--amber)" />
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
