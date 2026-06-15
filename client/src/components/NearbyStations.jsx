import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { apiOcmSearch } from '../api.js'
import OperatorLogo from './OperatorLogo.jsx'

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2-lat1)*Math.PI/180
  const dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatDist(km) {
  return km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`
}

export default function NearbyStations({ onPick, settings }) {
  const [state, setState] = useState('idle') // idle | loading | results | error
  const [stations, setStations] = useState([])
  const [userPos, setUserPos] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const [filter, setFilter] = useState('')

  async function handleOpen() {
    setState('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserPos({ lat, lng })
        try {
          const results = await apiOcmSearch({ lat, lng })
          // Add home if settings available
          const withHome = settings?.homeLat ? [
            {
              _isHome: true,
              AddressInfo: {
                Title: settings.homeLabel || 'Domicile',
                AddressLine1: '',
                Latitude: settings.homeLat,
                Longitude: settings.homeLng,
              },
              Connections: [],
              OperatorInfo: null,
            },
            ...results
          ] : results

          // Sort by distance from user
          const sorted = withHome.map(s => ({
            ...s,
            _dist: distanceKm(lat, lng, s.AddressInfo.Latitude, s.AddressInfo.Longitude)
          })).sort((a,b) => a._dist - b._dist)

          setStations(sorted)
          setState('results')
        } catch(e) { console.error('OCM nearby error:', e); setState('error') }
      },
      (err) => {
        console.error('Geoloc error:', err.code, err.message)
        setState('error')
        setGeoError(err.code === 1 ? 'Autorisation refusée' : err.code === 2 ? 'Position indisponible' : 'Timeout')
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: false }
    )
  }

  function pickStation(s) {
    if (s._isHome) {
      onPick({
        lat: s.AddressInfo.Latitude, lng: s.AddressInfo.Longitude,
        label: s.AddressInfo.Title,
        approximate: false, ocmId: null,
        operator: null, powerKw: null, connectorTypes: [],
        _isHome: true,
      })
    } else {
      const maxPwr = s.Connections?.reduce((m,c)=>Math.max(m,c.PowerKW||0),0) || null
      const connTypes = [...new Set((s.Connections||[]).map(c=>c.ConnectionType?.Title).filter(Boolean))]
      onPick({
        lat: s.AddressInfo.Latitude, lng: s.AddressInfo.Longitude,
        label: s.AddressInfo.Title,
        approximate: false,
        ocmId: s.ID?.toString(),
        operator: s.OperatorInfo?.Title || null,
        powerKw: maxPwr, connectorTypes: connTypes,
      })
    }
    setState('idle')
  }

  const filtered = filter.trim()
    ? stations.filter(s => s.AddressInfo.Title.toLowerCase().includes(filter.toLowerCase()) || (s.OperatorInfo?.Title||'').toLowerCase().includes(filter.toLowerCase()))
    : stations

  const sheet = state !== 'idle' && createPortal(
    <>
      <div onClick={()=>setState('idle')} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400 }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderRadius:'20px 20px 0 0', zIndex:401, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.4)', animation:'slideUp 0.2s ease' }}>
        <div style={{ padding:'14px 20px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>Bornes autour de moi</div>
          <button onClick={()=>setState('idle')} style={{ width:32, height:32, borderRadius:'50%', background:'var(--surface2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16 }}>×</button>
        </div>

        {state === 'loading' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:32, color:'var(--muted)', fontSize:13 }}>
            <div style={{ fontSize:28 }}>📡</div>
            Localisation en cours…
          </div>
        )}

        {state === 'error' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:32, color:'var(--muted)', fontSize:13, textAlign:'center' }}>
            <div style={{ fontSize:28 }}>⚠️</div>
            <div style={{ fontWeight:600, color:"var(--text)" }}>{geoError || "Impossible d'accéder à ta position"}</div>
            {geoError === 'Autorisation refusée' && (
              <div style={{ fontSize:11, lineHeight:1.5 }}>Vérifie les autorisations de localisation dans les réglages de ton navigateur pour ce site.</div>
            )}
            <button onClick={handleOpen} style={{ color:'var(--accent)', background:'none', border:'none', fontWeight:600, cursor:'pointer', fontSize:13 }}>Réessayer</button>
          </div>
        )}

        {state === 'results' && (
          <>
            {/* Search filter */}
            <div style={{ padding:'0 16px 10px', flexShrink:0 }}>
              <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtrer par nom ou opérateur…"
                style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'9px 14px', fontSize:13, color:'var(--text)', outline:'none' }} />
            </div>

            <div style={{ overflowY:'auto', flex:1, paddingBottom:32 }}>
              {filtered.map((s, i) => {
                const title = s.AddressInfo.Title
                const operator = s._isHome ? null : (s.OperatorInfo?.Title || null)
                const maxPwr = s._isHome ? null : (s.Connections?.reduce((m,c)=>Math.max(m,c.PowerKW||0),0) || null)
                const connTypes = s._isHome ? [] : [...new Set((s.Connections||[]).map(c=>c.ConnectionType?.Title).filter(Boolean))]
                const nbPts = s._isHome ? null : (s.Connections?.length || null)

                return (
                  <div key={i} onClick={()=>pickStation(s)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    {/* Logo */}
                    <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {s._isHome
                        ? <span style={{ fontSize:20 }}>🏠</span>
                        : <OperatorLogo name={operator||''} size={40} style={{ width:40, height:40, objectFit:'cover', borderRadius:10 }} />
                      }
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                        {operator && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(79,142,247,0.1)', color:'var(--accent)', border:'1px solid rgba(79,142,247,0.2)' }}>{operator}</span>}
                        {maxPwr > 0 && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(79,142,247,0.08)', color:'var(--mg4)', border:'1px solid rgba(79,142,247,0.15)', fontFamily:"'JetBrains Mono',monospace" }}>{maxPwr} kW</span>}
                        {nbPts > 0 && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--muted)', border:'1px solid var(--border)' }}>{nbPts} pt{nbPts>1?'s':''}</span>}
                        {connTypes.slice(0,2).map(t=><span key={t} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--muted)', border:'1px solid var(--border)' }}>{t}</span>)}
                      </div>
                    </div>

                    {/* Distance */}
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color: s._isHome?'var(--green)':s._dist<2?'var(--green)':s._dist<10?'var(--accent)':'var(--muted)', fontFamily:"'JetBrains Mono',monospace" }}>
                        {s._isHome ? '🏠' : formatDist(s._dist)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }`}</style>
    </>,
    document.body
  )

  return (
    <>
      <button onClick={handleOpen} style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'10px 14px', borderRadius:'var(--r-sm)',
        background:'var(--surface2)', border:'1px solid var(--border)',
        color:'var(--accent)', fontSize:13, fontWeight:600,
        cursor:'pointer', transition:'all 0.15s', width:'100%',
      }}
        onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
        onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
        </svg>
        Bornes autour de moi
      </button>
      {sheet}
    </>
  )
}
