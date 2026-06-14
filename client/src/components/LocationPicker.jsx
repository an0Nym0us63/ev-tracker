import React, { useState, useRef } from 'react'
import { apiOcmSearch, apiGeocode } from '../api.js'

const OPERATOR_ICONS = {
  'ionity': '🟡', 'totalenergies': '🔴', 'total': '🔴',
  'fastned': '🟠', 'tesla': '⚡', 'lidl': '🔵',
  'leclerc': '🔵', 'engie': '🟢', 'izivia': '🔵',
  'freshmile': '🟣', 'recharge': '🔵', 'chargemap': '🔵',
  'beev': '🔵', 'bump': '🟢', 'electra': '🟣',
}
function operatorIcon(name='') {
  const key = Object.keys(OPERATOR_ICONS).find(k => name.toLowerCase().includes(k))
  return key ? OPERATOR_ICONS[key] : '🔌'
}

// Two-step search:
// 1. User types city → geocode → get lat/lng → search OCM by coords
// 2. User can also type operator name to filter
export default function LocationPicker({ value, onChange }) {
  const [cityQuery,     setCityQuery]     = useState('')
  const [operatorQuery, setOperatorQuery] = useState('')
  const [cityResults,   setCityResults]   = useState([])
  const [stations,      setStations]      = useState([])
  const [selectedCity,  setSelectedCity]  = useState(null)
  const [step,          setStep]          = useState('city') // city | stations | picked
  const [loading,       setLoading]       = useState(false)
  const debounce = useRef(null)

  function handleCityChange(e) {
    const q = e.target.value
    setCityQuery(q)
    setSelectedCity(null)
    setStations([])
    if (!q.trim()) { setCityResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => geocodeCity(q), 400)
  }

  async function geocodeCity(q) {
    setLoading(true)
    try {
      const results = await apiGeocode(q)
      setCityResults(results.slice(0, 4))
    } catch {} finally { setLoading(false) }
  }

  async function pickCity(place) {
    const label = place.label.split(',').slice(0,2).join(',').trim()
    setCityQuery(label)
    setCityResults([])
    setSelectedCity(place)
    setStep('stations')
    setLoading(true)
    try {
      const results = await apiOcmSearch({ lat: place.lat, lng: place.lng })
      setStations(results)
    } catch { setStations([]) }
    finally { setLoading(false) }
  }

  function filteredStations() {
    if (!operatorQuery.trim()) return stations
    const q = operatorQuery.toLowerCase()
    return stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.operator.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    )
  }

  function pickStation(station) {
    onChange({
      lat: station.lat, lng: station.lng,
      label: station.name + (station.city ? `, ${station.city}` : ''),
      approximate: false,
      ocmId: station.id,
      operator: station.operator,
    })
    setStep('picked')
  }

  function pickCityApprox() {
    if (!selectedCity) return
    const label = cityQuery
    onChange({ lat: selectedCity.lat, lng: selectedCity.lng, label, approximate: true, ocmId: null, operator: null })
    setStep('picked')
  }

  function reset() {
    setCityQuery(''); setOperatorQuery(''); setCityResults([])
    setStations([]); setSelectedCity(null); setStep('city'); onChange(null)
  }

  // ── Picked state ──
  if (step === 'picked' && value) {
    return (
      <div style={{ background:'var(--surface)', border:`1.5px solid ${value.approximate?'var(--amber)':'var(--green)'}`, borderRadius:'var(--r-sm)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18 }}>{value.approximate ? '📍' : '🔌'}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600 }}>{value.label}</div>
          <div style={{ fontSize:11, color:value.approximate?'var(--amber)':'var(--green)', marginTop:2 }}>
            {value.approximate ? 'Position approximative (ville)' : `Borne exacte${value.operator ? ` · ${value.operator}` : ''}`}
          </div>
        </div>
        <button onClick={reset} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:18 }}>×</button>
      </div>
    )
  }

  // ── Step 1 : city search ──
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

      {/* City input */}
      <div style={{ position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'12px 14px' }}>
          <span style={{ fontSize:16 }}>🏙️</span>
          <input
            value={cityQuery}
            onChange={handleCityChange}
            placeholder="1. Tape une ville ou commune…"
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'var(--text)', fontFamily:'inherit' }}
          />
          {loading && <div style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />}
          {(cityQuery || value) && <button onClick={reset} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:18 }}>×</button>}
        </div>

        {/* City results dropdown */}
        {cityResults.length > 0 && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', zIndex:50, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', overflow:'hidden' }}>
            {cityResults.map((r,i) => (
              <div key={i} onMouseDown={()=>pickCity(r)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:i<cityResults.length-1?'1px solid var(--border)':'none', fontSize:13, display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <span>📍</span>
                <span>{r.label.split(',').slice(0,3).join(',')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 : filter stations */}
      {step === 'stations' && (
        <>
          {/* Operator filter */}
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'12px 14px' }}>
            <span style={{ fontSize:16 }}>🔍</span>
            <input
              value={operatorQuery}
              onChange={e=>setOperatorQuery(e.target.value)}
              placeholder="2. Filtre par opérateur, nom… (optionnel)"
              style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'var(--text)', fontFamily:'inherit' }}
            />
          </div>

          {/* Station list */}
          {stations.length === 0 && !loading ? (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'12px 14px' }}>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:10 }}>
                Aucune borne trouvée dans Open Charge Map autour de <b>{cityQuery}</b>.
              </div>
              <button onMouseDown={pickCityApprox} style={{ fontSize:12, fontWeight:600, color:'var(--amber)', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:20, padding:'6px 14px', cursor:'pointer' }}>
                📍 Utiliser {cityQuery} comme position approximative
              </button>
            </div>
          ) : (
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', overflow:'hidden', maxHeight:240, overflowY:'auto' }}>
              <div style={{ padding:'6px 12px 4px', fontSize:10, fontWeight:600, color:'var(--muted)', letterSpacing:'0.06em', textTransform:'uppercase', display:'flex', justifyContent:'space-between' }}>
                <span>Bornes près de {cityQuery}</span>
                <span>{filteredStations().length} résultat{filteredStations().length>1?'s':''}</span>
              </div>
              {filteredStations().map((s,i,arr) => (
                <div key={s.id} onMouseDown={()=>pickStation(s)} style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <span style={{ fontSize:20, flexShrink:0 }}>{operatorIcon(s.operator)}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
                      {s.operator}{s.power ? ` · ${s.power} kW` : ''}{s.city ? ` · ${s.city}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize:11, color:'var(--green)', flexShrink:0 }}>Sélectionner</span>
                </div>
              ))}
              {/* Always offer approx option at bottom */}
              <div onMouseDown={pickCityApprox} style={{ padding:'10px 14px', cursor:'pointer', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, opacity:0.7 }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <span style={{ fontSize:20 }}>📍</span>
                <div style={{ fontSize:12, color:'var(--amber)' }}>Utiliser <b>{cityQuery}</b> comme position approximative</div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
