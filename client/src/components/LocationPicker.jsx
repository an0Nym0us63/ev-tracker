import React, { useState, useRef, useEffect } from 'react'
import { apiOcmSearch, apiGeocode } from '../api.js'
import OperatorLogo from './OperatorLogo.jsx'

function GeoResultItem({ r, onPick }) {
  const tags = [r.postcode, r.dept, !r.isFr && r.region, r.country].filter(Boolean)
  return (
    <div onClick={onPick}
      style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', userSelect:'none' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.name}</div>
      {tags.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
          {tags.map((t,i) => (
            <span key={i} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LocationPicker({ value, onChange }) {
  // If value already set (edit mode), start in picked state
  const [step,          setStep]          = useState(value ? 'picked' : 'idle')
  const [query,         setQuery]         = useState('')
  const [geoResults,    setGeoResults]    = useState([])
  const [stations,      setStations]      = useState([])
  const [stationFilter, setStationFilter] = useState('')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [loading,       setLoading]       = useState(false)
  const debounce = useRef(null)

  // Sync if parent resets value (e.g. form reset)
  useEffect(() => {
    if (!value && step === 'picked') setStep('idle')
    if (value && step === 'idle')   setStep('picked')
  }, [value])

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) { setGeoResults([]); setStep('idle'); return }
    setStep('geo')
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => searchGeo(q), 350)
  }

  async function searchGeo(q) {
    setLoading(true)
    try {
      const results = await apiGeocode(q)
      setGeoResults(results)
    } catch { setGeoResults([]) }
    finally { setLoading(false) }
  }

  async function pickPlace(place) {
    const label = [place.name, place.postcode].filter(Boolean).join(' ')
    setQuery(label)
    setGeoResults([])
    setSelectedPlace(place)
    setStep('stations')
    setStationFilter('')
    setLoading(true)
    try {
      const results = await apiOcmSearch({ lat: place.lat, lng: place.lng })
      setStations(results)
    } catch { setStations([]) }
    finally { setLoading(false) }
  }

  function filtered() {
    if (!stationFilter.trim()) return stations
    const q = stationFilter.toLowerCase()
    return stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.operator.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    )
  }

  function pickStation(s) {
    onChange({
      lat: s.lat, lng: s.lng,
      label: `${s.name}${s.city ? `, ${s.city}` : ''}`,
      approximate: false,
      ocmId: s.id,
      operator: s.operator || s.network || '',
      powerKw: s.power || null,
      connectorTypes: s.connectorTypes || [],
      totalPoints: s.totalPoints || null,
    })
    setStep('picked')
  }

  function pickApprox() {
    if (!selectedPlace) return
    const label = [selectedPlace.name, selectedPlace.postcode].filter(Boolean).join(' ')
    onChange({ lat: selectedPlace.lat, lng: selectedPlace.lng, label, approximate: true, ocmId: null, operator: null, powerKw: null })
    setStep('picked')
  }

  function reset() {
    setQuery(''); setGeoResults([]); setStations([])
    setSelectedPlace(null); setStep('idle'); onChange(null)
  }

  // ── Picked ──
  if (step === 'picked' && value) {
    return (
      <div style={{ background:'var(--surface)', border:`1.5px solid ${value.approximate?'var(--amber)':'var(--green)'}`, borderRadius:'var(--r-sm)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        {value.approximate
          ? <span style={{ fontSize:18 }}>📍</span>
          : <div style={{ width:36, height:36, borderRadius:9, overflow:'hidden', background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <OperatorLogo name={value.operator||''} size={36} style={{ width:36, height:36, objectFit:'cover', borderRadius:9 }} />
            </div>
        }
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600 }}>{value.label}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
            {value.approximate
              ? <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(245,158,11,0.1)', color:'var(--amber)', border:'1px solid rgba(245,158,11,0.3)' }}>Position approximative</span>
              : <>
                  {value.operator && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>{value.operator}</span>}
                  {value.powerKw  && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(79,142,247,0.1)', color:'var(--mg4)', border:'1px solid rgba(79,142,247,0.2)' }}>{value.powerKw} kW</span>}
                  {(value.connectorTypes||[]).map(t => <span key={t} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(124,92,252,0.1)', color:'var(--xpeng)', border:'1px solid rgba(124,92,252,0.2)' }}>{t}</span>)}
                  {value.totalPoints && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--muted)', border:'1px solid var(--border)' }}>{value.totalPoints} pt{value.totalPoints>1?'s':''}</span>}
                  <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(34,197,94,0.1)', color:'var(--green)', border:'1px solid rgba(34,197,94,0.2)' }}>OCM ✓</span>
                </>
            }
          </div>
        </div>
        <button onClick={reset} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:20, lineHeight:1, flexShrink:0 }}>×</button>
      </div>
    )
  }

  // ── Search ──
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

      {/* City input */}
      <div style={{ position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:`1.5px solid ${step==='geo'||step==='stations'?'var(--accent)':'var(--border)'}`, borderRadius:'var(--r-sm)', padding:'12px 14px', transition:'border-color 0.15s' }}>
          <span style={{ fontSize:16, flexShrink:0 }}>🏙️</span>
          <input value={query} onChange={handleQueryChange}
            placeholder="Ville, commune, quartier…"
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'var(--text)', fontFamily:'inherit' }}
          />
          {loading && <div style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />}
          {query && <button onClick={reset} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:20, lineHeight:1, flexShrink:0 }}>×</button>}
        </div>

        {/* Geo dropdown */}
        {step === 'geo' && geoResults.length > 0 && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', zIndex:50, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', overflow:'hidden', maxHeight:320, overflowY:'auto' }}>
            <div style={{ padding:'7px 14px 4px', fontSize:10, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
              {geoResults.length} résultat{geoResults.length>1?'s':''}
            </div>
            {geoResults.map((r,i) => <GeoResultItem key={i} r={r} onPick={()=>pickPlace(r)} />)}
          </div>
        )}
        {step === 'geo' && geoResults.length === 0 && !loading && query && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', zIndex:50, padding:'12px 14px', fontSize:13, color:'var(--muted)' }}>
            Aucun résultat pour « {query} »
          </div>
        )}
      </div>

      {/* Station list (step 2) */}
      {step === 'stations' && (
        <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:14, flexShrink:0 }}>🔍</span>
            <input value={stationFilter} onChange={e=>setStationFilter(e.target.value)}
              placeholder="Filtrer par nom, opérateur…"
              style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'var(--text)', fontFamily:'inherit' }}
              autoFocus
            />
            {loading && <div style={{ width:12, height:12, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />}
          </div>

          <div style={{ padding:'5px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>
              Autour de {[selectedPlace?.name, selectedPlace?.postcode].filter(Boolean).join(' ')}
            </span>
            <span style={{ fontSize:10, color:'var(--muted)' }}>{filtered().length} borne{filtered().length!==1?'s':''}</span>
          </div>

          <div style={{ maxHeight:280, overflowY:'auto' }}>
            {loading && stations.length === 0
              ? <div style={{ padding:'16px 14px', fontSize:13, color:'var(--muted)' }}>Chargement des bornes…</div>
              : filtered().length === 0 && !loading
                ? <div style={{ padding:'12px 14px', fontSize:13, color:'var(--muted)' }}>
                    {stations.length === 0 ? 'Aucune borne Open Charge Map dans ce secteur.' : 'Aucun résultat pour ce filtre.'}
                  </div>
                : filtered().map(s => (
                  <div key={s.id}
                    onClick={()=>pickStation(s)}
                    style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:10, userSelect:'none' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <OperatorLogo name={s.operator || s.network || ''} size={22} style={{ marginTop:1 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                        {s.operator && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>{s.operator}</span>}
                        {s.power    && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(79,142,247,0.1)', color:'var(--mg4)', border:'1px solid rgba(79,142,247,0.2)' }}>{s.power} kW</span>}
                        {(s.connectorTypes||[]).map(t => <span key={t} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(124,92,252,0.1)', color:'var(--xpeng)', border:'1px solid rgba(124,92,252,0.2)' }}>{t}</span>)}
                        {s.totalPoints && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--muted)', border:'1px solid var(--border)' }}>{s.totalPoints} pt{s.totalPoints>1?'s':''}</span>}
                        {s.city     && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface)', color:'var(--muted)', border:'1px solid var(--border)' }}>{s.city}</span>}
                      </div>
                      {s.address && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{s.address}</div>}
                    </div>
                    <span style={{ fontSize:11, color:'var(--green)', flexShrink:0, marginTop:2, fontWeight:600 }}>→</span>
                  </div>
                ))
            }
          </div>

          {/* Approx option */}
          <div onClick={pickApprox}
            style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, background:'rgba(245,158,11,0.04)', userSelect:'none' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(245,158,11,0.08)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(245,158,11,0.04)'}
          >
            <span style={{ fontSize:18 }}>📍</span>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--amber)' }}>
                Utiliser « {[selectedPlace?.name, selectedPlace?.postcode].filter(Boolean).join(' ')} » en position approximative
              </div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>La borne n'est pas dans OCM</div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
