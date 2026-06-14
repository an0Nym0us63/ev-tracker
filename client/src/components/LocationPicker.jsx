import React, { useState, useRef, useEffect } from 'react'
import { apiOcmSearch, apiGeocode } from '../api.js'

// Known operator logos (favicon-based)
const OPERATOR_ICONS = {
  'ionity':         '🟡',
  'totalenergies':  '🔴',
  'total':          '🔴',
  'fastned':        '🟠',
  'tesla':          '⚡',
  'lidl':           '🔵',
  'leclerc':        '🔵',
  'engie':          '🟢',
  'izivia':         '🔵',
  'freshmile':      '🟣',
  'recharge':       '🔵',
  'chargemap':      '🔵',
}

function operatorIcon(name = '') {
  const key = Object.keys(OPERATOR_ICONS).find(k => name.toLowerCase().includes(k))
  return key ? OPERATOR_ICONS[key] : '🔌'
}

export default function LocationPicker({ value, onChange, disabled }) {
  // value = { lat, lng, label, approximate, ocmId, operator }
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [mode,     setMode]     = useState('idle') // idle | searching | ocm | city | picked
  const [loading,  setLoading]  = useState(false)
  const [hasOcm,   setHasOcm]   = useState(true) // assume true until API returns empty
  const debounce   = useRef(null)

  // Show current picked label
  const pickedLabel = value?.label || ''

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    setMode('searching')
    if (value) onChange(null) // clear on type

    clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); setMode('idle'); return }

    debounce.current = setTimeout(() => searchOcm(q), 400)
  }

  async function searchOcm(q) {
    setLoading(true)
    try {
      const res = await apiOcmSearch({ q })
      if (res.length === 0) {
        setHasOcm(false)
        setMode('city')
        await searchCity(q)
      } else {
        setHasOcm(true)
        setResults(res)
        setMode('ocm')
      }
    } catch {
      setMode('city')
      await searchCity(q)
    } finally { setLoading(false) }
  }

  async function searchCity(q) {
    setLoading(true)
    try {
      const res = await apiGeocode(q)
      setResults(res.slice(0, 4))
      setMode('city')
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  function pickOcm(station) {
    onChange({
      lat: station.lat, lng: station.lng,
      label: station.name + (station.city ? `, ${station.city}` : ''),
      approximate: false,
      ocmId: station.id,
      operator: station.operator,
    })
    setQuery(station.name)
    setResults([])
    setMode('picked')
  }

  function pickCity(place) {
    // Short label — just city name
    const short = place.label.split(',')[0]
    onChange({
      lat: place.lat, lng: place.lng,
      label: short,
      approximate: true,
      ocmId: null,
      operator: null,
    })
    setQuery(short)
    setResults([])
    setMode('picked')
  }

  function clear() {
    setQuery('')
    setResults([])
    setMode('idle')
    onChange(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface)', border: `1.5px solid ${value ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 'var(--r-sm)', padding: '12px 14px',
        transition: 'border-color 0.15s',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>
          {value ? (value.approximate ? '📍' : '🔌') : '🔍'}
        </span>
        <input
          value={value ? value.label : query}
          onChange={handleQueryChange}
          placeholder="Rechercher une borne ou une ville…"
          disabled={disabled}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }}
        />
        {(value || query) && (
          <button onClick={clear} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        )}
        {loading && <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
      </div>

      {/* Status */}
      {value && (
        <div style={{ fontSize: 11, color: value.approximate ? 'var(--amber)' : 'var(--green)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          {value.approximate ? '📍 Position approximative (ville)' : `✓ Borne localisée${value.operator ? ` · ${value.operator}` : ''}`}
        </div>
      )}

      {!hasOcm && mode === 'city' && !loading && !value && query && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
          Borne non trouvée dans Open Charge Map — sélectionne une ville pour localiser approximativement
        </div>
      )}

      {/* Dropdown */}
      {results.length > 0 && !value && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
        }}>
          {mode === 'ocm' && (
            <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Bornes Open Charge Map
            </div>
          )}
          {mode === 'city' && (
            <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              📍 Position approximative — villes
            </div>
          )}

          {mode === 'ocm' && results.map((s, i) => (
            <div key={s.id} onMouseDown={() => pickOcm(s)} style={{
              padding: '10px 14px', cursor: 'pointer',
              borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{operatorIcon(s.operator)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  {s.address}{s.city ? `, ${s.city}` : ''}
                  {s.power ? ` · ${s.power} kW` : ''}
                </div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>🔌</span>
            </div>
          ))}

          {mode === 'city' && results.map((r, i) => (
            <div key={i} onMouseDown={() => pickCity(r)} style={{
              padding: '10px 14px', cursor: 'pointer',
              borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 18 }}>📍</span>
              <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.label.split(',').slice(0, 2).join(',')}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
