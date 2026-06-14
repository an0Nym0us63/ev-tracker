import React, { useState, useRef } from 'react'
import { apiOcmSearch, apiGeocode } from '../api.js'

const OPERATOR_ICONS = {
  'ionity':'🟡','totalenergies':'🔴','total':'🔴','fastned':'🟠',
  'tesla':'⚡','lidl':'🔵','leclerc':'🔵','engie':'🟢','izivia':'🔵',
  'freshmile':'🟣','electra':'🟣','bump':'🟢','beev':'🔵','recharge':'🔵',
}
function operatorIcon(name='') {
  const k = Object.keys(OPERATOR_ICONS).find(k => name.toLowerCase().includes(k))
  return k ? OPERATOR_ICONS[k] : '🔌'
}

// Tags for a geocode result — compact, readable on mobile
function GeoResultItem({ r, onPick }) {
  const tags = []
  if (r.postcode) tags.push(r.postcode)
  if (r.dept)    tags.push(r.dept)
  if (!r.isFr && r.region) tags.push(r.region)
  if (r.country) tags.push(r.country)

  return (
    <div
      onMouseDown={onPick}
      onTouchStart={onPick}
      style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', userSelect:'none' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      {/* Line 1: name */}
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.name}</div>
      {/* Line 2: tags */}
      {tags.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
          {tags.map((t,i) => (
            <span key={i} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LocationPicker({ value, onChange }) {
  const [query,         setQuery]         = useState('')
  const [geoResults,    setGeoResults]    = useState([])
  const [stations,      setStations]      = useState([])
  const [stationFilter, setStationFilter] = useState('')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [step,          setStep]          = useState('idle') // idle | geo | stations | picked
  const [loading,       setLoading]       = useState(false)
  const debounce = useRef(null)

  // ── Step 1: type to search cities ──
  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) { setGeoResults([]); setStep('idle'); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => searchGeo(q), 350)
  }

  async function searchGeo(q) {
    setLoading(true)
    try {
      const results = await apiGeocode(q)
      setGeoResults(results)
      setStep('geo')
    } catch { setGeoResults([]) }
    finally { setLoading(false) }
  }

  // ── Step 2: pick a city → load OCM stations nearby ──
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

  // ── Filtered stations list ──
  function filtered() {
    if (!stationFilter.trim()) return stations
    const q = stationFilter.toLowerCase()
    return stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.operator.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    )
  }

  // ── Pick a station ──
  function pickStation(s) {
    onChange({ lat:s.lat, lng:s.lng, label:`${s.name}${s.city?`, ${s.city}`:''}`, approximate:false, ocmId:s.id, operator:s.operator })
    setStep('picked')
  }

  // ── Pick city as approx ──
  function pickApprox() {
    if (!selectedPlace) return
    const label = [selectedPlace.name, selectedPlace.postcode].filter(Boolean).join(' ')
    onChange({ lat:selectedPlace.lat, lng:selectedPlace.lng, label, approximate:true, ocmId:null, operator:null })
    setStep('picked')
  }

  // ── Reset ──
  function reset() {
    setQuery(''); setGeoResults([]); setStations([])
    setSelectedPlace(null); setStep('idle'); onChange(null)
  }

  // ── Picked state ──
  if (step === 'picked' && value) {
    return (
      <div style={{ background:'var(--surface)', border:`1.5px solid ${value.approximate?'var(--amber)':'var(--green)'}`, borderRadius:'var(--r-sm)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18 }}>{value.approximate ? '📍' : '🔌'}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600 }}>{value.label}</div>
          <div style={{ fontSize:11, color:value.approximate?'var(--amber)':'var(--green)', marginTop:2 }}>
            {value.approximate ? 'Position approximative' : `Borne OCM${value.operator?` · ${value.operator}`:''}`}
          </div>
        </div>
        <button onClick={reset} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

      {/* ── City search input ── */}
      <div style={{ position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:`1.5px solid ${step==='geo'||step==='stations'?'var(--accent)':'var(--border)'}`, borderRadius:'var(--r-sm)', padding:'12px 14px', transition:'border-color 0.15s' }}>
          <span style={{ fontSize:16, flexShrink:0 }}>🏙️</span>
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Ville, commune, quartier…"
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'var(--text)', fontFamily:'inherit' }}
          />
          {loading && (
            <div style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />
          )}
          {(query || value) && (
            <button onClick={reset} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:20, lineHeight:1, flexShrink:0 }}>×</button>
          )}
        </div>

        {/* Geo results dropdown */}
        {step === 'geo' && geoResults.length > 0 && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', zIndex:50, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', overflow:'hidden', maxHeight:320, overflowY:'auto' }}>
            <div style={{ padding:'7px 14px 4px', fontSize:10, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
              {geoResults.length} résultat{geoResults.length>1?'s':''}
            </div>
            {geoResults.map((r,i) => (
              <GeoResultItem key={i} r={r} onPick={()=>pickPlace(r)} />
            ))}
          </div>
        )}

        {step === 'geo' && geoResults.length === 0 && !loading && query && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', zIndex:50, padding:'12px 14px', fontSize:13, color:'var(--muted)' }}>
            Aucun résultat pour « {query} »
          </div>
        )}
      </div>

      {/* ── Station search (step 2) ── */}
      {step === 'stations' && (
        <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', overflow:'hidden' }}>

          {/* Filter bar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:14, flexShrink:0 }}>🔍</span>
            <input
              value={stationFilter}
              onChange={e=>setStationFilter(e.target.value)}
              placeholder="Filtrer par nom, opérateur…"
              style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'var(--text)', fontFamily:'inherit' }}
              autoFocus
            />
            {loading && <div style={{ width:12, height:12, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />}
          </div>

          {/* Header */}
          <div style={{ padding:'6px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>
              Bornes autour de {[selectedPlace?.name, selectedPlace?.postcode].filter(Boolean).join(' ')}
            </span>
            <span style={{ fontSize:10, color:'var(--muted)' }}>{filtered().length} résultat{filtered().length!==1?'s':''}</span>
          </div>

          {/* Station list */}
          <div style={{ maxHeight:260, overflowY:'auto' }}>
            {loading && stations.length === 0 ? (
              <div style={{ padding:'16px 14px', fontSize:13, color:'var(--muted)' }}>Chargement des bornes…</div>
            ) : filtered().length === 0 && !loading ? (
              <div style={{ padding:'12px 14px', fontSize:13, color:'var(--muted)' }}>
                {stations.length === 0 ? 'Aucune borne Open Charge Map dans ce secteur.' : 'Aucun résultat pour ce filtre.'}
              </div>
            ) : filtered().map(s => (
              <div key={s.id}
                onMouseDown={()=>pickStation(s)}
                onTouchStart={()=>pickStation(s)}
                style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:10, userSelect:'none' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{operatorIcon(s.operator)}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                    {s.operator && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>{s.operator}</span>}
                    {s.power    && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(79,142,247,0.1)', color:'var(--mg4)', border:'1px solid rgba(79,142,247,0.2)' }}>{s.power} kW</span>}
                    {s.city     && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface)', color:'var(--muted)', border:'1px solid var(--border)' }}>{s.city}</span>}
                  </div>
                  {s.address && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{s.address}</div>}
                </div>
                <span style={{ fontSize:11, color:'var(--green)', flexShrink:0, marginTop:2, fontWeight:600 }}>→</span>
              </div>
            ))}
          </div>

          {/* Approx option — always at bottom */}
          <div
            onMouseDown={pickApprox}
            onTouchStart={pickApprox}
            style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, background:'rgba(245,158,11,0.04)', userSelect:'none' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(245,158,11,0.08)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(245,158,11,0.04)'}
          >
            <span style={{ fontSize:18 }}>📍</span>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--amber)' }}>
                Utiliser « {[selectedPlace?.name, selectedPlace?.postcode].filter(Boolean).join(' ')} » comme position approximative
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
