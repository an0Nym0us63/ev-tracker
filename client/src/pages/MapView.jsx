import React, { useEffect, useRef, useState } from 'react'
import { VEHICLES, LOCATIONS } from '../utils.js'

// Leaflet loaded via CDN in index.html — accessed via window.L
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) { resolve(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = LEAFLET_CSS
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.onload = resolve
    document.head.appendChild(script)
  })
}

export default function MapView({ charges, settings }) {
  const mapRef    = useRef(null)
  const mapInst   = useRef(null)
  const [ready,   setReady]   = useState(false)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    loadLeaflet().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return

    // Init map once
    if (!mapInst.current) {
      mapInst.current = window.L.map(mapRef.current, { zoomControl: true }).setView([46.8, 2.3], 6)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
      }).addTo(mapInst.current)
    }

    const map = mapInst.current

    // Clear existing markers
    map.eachLayer(l => { if (l instanceof window.L.Marker || l instanceof window.L.CircleMarker) map.removeLayer(l) })

    const filtered = charges.filter(c => {
      if (filter !== 'all' && c.vehicleId !== filter) return false
      return c.lat && c.lng
    })

    if (filtered.length === 0) return

    const bounds = []

    // Home marker
    if (settings?.homeLat && settings?.homeLng) {
      const homeIcon = window.L.divIcon({
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#22c55e;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
      })
      window.L.marker([settings.homeLat, settings.homeLng], { icon: homeIcon })
        .addTo(map)
        .bindPopup(`<b>Domicile</b><br>${settings.homeLabel || ''}`)
    }

    // Charge markers
    filtered.forEach(c => {
      const v = VEHICLES[c.vehicleId]
      const color = c.vehicleId === 'mg4' ? '#4f8ef7' : '#7c5cfc'
      const isApprox = c.locationApproximate
      const cost = c.totalCost?.toFixed(2)

      const icon = window.L.divIcon({
        html: `<div style="
          width:${isApprox?26:30}px;height:${isApprox?26:30}px;border-radius:50%;
          background:${color};border:2px solid ${isApprox?'rgba(255,255,255,0.4)':'#fff'};
          display:flex;align-items:center;justify-content:center;font-size:13px;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          ${isApprox?'opacity:0.7;border-style:dashed':''}
        ">${v.emoji}</div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 15],
      })

      window.L.marker([c.lat, c.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <b>${v.name}</b> · ${c.date}<br>
          ${c.provider || c.locationName || ''}<br>
          <b>${c.kwh} kWh</b> · ${cost} €
          ${isApprox ? '<br><small style="color:#f59e0b">📍 Position approximative</small>' : ''}
        `)

      bounds.push([c.lat, c.lng])
    })

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [ready, charges, filter, settings])

  // Cleanup on unmount
  useEffect(() => () => {
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
  }, [])

  const withCoords = charges.filter(c => c.lat && c.lng)
  const withoutCoords = charges.filter(c => !c.lat && !c.lng)

  return (
    <div className="page fade-up" style={{ paddingBottom: 0 }}>
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Carte</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
        {[{ id:'all', label:'Tous' }, { id:'mg4', label:'MG4' }, { id:'xpeng', label:'Xpeng G6' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filter === f.id ? (f.id==='mg4'?'var(--mg4)':f.id==='xpeng'?'var(--xpeng)':'var(--accent)') : 'var(--border)'}`,
            background: filter === f.id ? `rgba(${f.id==='mg4'?'79,142,247':f.id==='xpeng'?'124,92,252':'79,142,247'},0.1)` : 'var(--surface)',
            color: filter === f.id ? (f.id==='mg4'?'var(--mg4)':f.id==='xpeng'?'var(--xpeng)':'var(--accent)') : 'var(--muted)',
            cursor: 'pointer', transition: 'all 0.12s',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, padding: '8px 16px 0', fontSize: 11, color: 'var(--muted)' }}>
        <span>🔌 Borne exacte</span>
        <span style={{ opacity: 0.6 }}>📍 Position approx.</span>
      </div>

      {/* Map */}
      <div style={{ margin: '10px 16px 0', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', height: 380 }}>
        {!ready ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13 }}>
            Chargement de la carte…
          </div>
        ) : withCoords.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13, gap: 8 }}>
            <span style={{ fontSize: 32 }}>🗺️</span>
            Aucune session avec localisation.<br/>
            Recherche une borne lors de la saisie.
          </div>
        ) : (
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {/* Stats */}
      {charges.length > 0 && (
        <div style={{ margin: '10px 16px 0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{withCoords.length}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Sessions localisées</div>
            </div>
            <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--muted)' }}>{withoutCoords.length}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Sans localisation</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
