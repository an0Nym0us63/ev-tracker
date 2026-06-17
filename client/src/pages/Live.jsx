import React, { useState, useEffect, useRef, useCallback } from 'react'
import ProfileMenu from '../components/ProfileMenu.jsx'
import { apiGetLiveVehicle } from '../api.js'
import { VEHICLES } from '../utils.js'

const POLL_INTERVAL_MS = 5000

export default function Live({ account, onLogout, theme, onToggleTheme, onNavigate }) {
  const [data, setData] = useState(null)       // last successful payload from /api/live/vehicle
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  const fetchLive = useCallback(async () => {
    try {
      const result = await apiGetLiveVehicle()
      setData(result)
      setError(null)
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

  const vehicle = data?.vehicleId ? VEHICLES[data.vehicleId] : null

  return (
    <div className="page fade-up" style={{ paddingBottom:100, minHeight:'100dvh' }}>
      <div style={{ padding:'16px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Live</div>
        <ProfileMenu account={account} onNavigate={onNavigate} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      </div>

      <div style={{ padding:'16px 16px 0' }}>

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

        {!loading && !error && data && !data.available && (
          <div className="card" style={{ padding:'20px 16px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔌</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Home Assistant non configuré</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{data.reason}</div>
          </div>
        )}

        {!loading && !error && data?.available && (
          <div className="card" style={{ padding:'18px 16px' }}>
            <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>
              Véhicule branché
            </div>
            {vehicle ? (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:32 }}>{vehicle.emoji}</span>
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:vehicle.color }}>{vehicle.name}</div>
                  <div style={{ fontSize:11, color:'var(--green)', marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />
                    Détecté via Home Assistant
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:32 }}>🔌</span>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, color:'var(--muted)' }}>Aucun véhicule branché</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>État brut : {data.rawState || '—'}</div>
                </div>
              </div>
            )}
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:14, paddingTop:10, borderTop:'1px solid var(--border)' }}>
              Actualisé automatiquement toutes les 5 secondes
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
