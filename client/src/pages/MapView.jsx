import React, { useEffect, useRef, useState } from 'react'
import { VEHICLES } from '../utils.js'

const TILE_LAYERS = {
  dark:  { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap © CARTO' },
  light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap © CARTO' },
  osm:   { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
}

const OPERATOR_EMOJIS = {
  ionity:'⚡', totalenergies:'🔴', total:'🔴', fastned:'🟠', tesla:'⚡',
  lidl:'🔵', leclerc:'🔵', engie:'🟢', izivia:'🔵', freshmile:'🟣',
  electra:'🟣', bump:'🟢', driveco:'🟢', powerdot:'🔵', chargemap:'🔵',
  v2c:'🏠', wallbox:'🏠', trydan:'🏠',
}
function operatorEmoji(name='') {
  if (!name) return '🔌'
  const l = name.toLowerCase()
  const k = Object.keys(OPERATOR_EMOJIS).find(k => l.includes(k))
  return k ? OPERATOR_EMOJIS[k] : '🔌'
}

function toLogoName(name='') {
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
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

// Group charges by location: same ocmId or lat/lng rounded to ~100m
function groupByLocation(charges) {
  const groups = {}
  charges.forEach(c => {
    if (!c.lat || !c.lng) return
    const key = c.ocmId
      ? `ocm:${c.ocmId}`
      : `geo:${Math.round(c.lat*1000)/1000},${Math.round(c.lng*1000)/1000}`
    if (!groups[key]) groups[key] = { key, charges:[], lat:c.lat, lng:c.lng,
      label: c.locationName||c.provider||'Borne', operator: c.provider||'',
      approximate: c.locationApproximate, powerKw: c.powerKw }
    groups[key].charges.push(c)
  })
  return Object.values(groups)
}

function buildPopupHTML(group) {
  const { label, operator, powerKw, charges, approximate } = group
  const total = { kwh:0, cost:0, sessions:0 }
  const byVehicle = {}
  charges.forEach(c => {
    total.kwh += c.kwh; total.cost += c.totalCost||0; total.sessions++
    const v = VEHICLES[c.vehicleId]
    if (!byVehicle[c.vehicleId]) byVehicle[c.vehicleId] = { name:v.name, color:v.color, kwh:0, cost:0, sessions:0 }
    byVehicle[c.vehicleId].kwh  += c.kwh
    byVehicle[c.vehicleId].cost += c.totalCost||0
    byVehicle[c.vehicleId].sessions++
  })

  const vehicleRows = Object.values(byVehicle).map(v => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,0.08)">
      <div style="width:8px;height:8px;border-radius:50%;background:${v.color};flex-shrink:0"></div>
      <div style="flex:1;font-size:11px;color:#94a3b8">${v.name}</div>
      <div style="font-size:11px;font-family:monospace;color:#e2e8f0">${v.sessions}× · ${v.kwh.toFixed(1)} kWh · ${v.cost.toFixed(2)} €</div>
    </div>`).join('')

  return `
    <div style="min-width:220px;font-family:'Inter',sans-serif">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px">${label}</div>
      ${operator ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${operator}${powerKw?` · ${powerKw} kW`:''}</div>` : ''}
      ${approximate ? `<div style="font-size:10px;color:#f59e0b;margin-bottom:6px">📍 Position approximative</div>` : ''}
      <div style="background:rgba(79,142,247,0.1);border-radius:8px;padding:8px 10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:11px;color:#94a3b8">${total.sessions} session${total.sessions>1?'s':''}</div>
          <div style="font-size:13px;font-weight:700;font-family:monospace;color:#60a5fa">${total.kwh.toFixed(1)} kWh</div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:2px">
          <div style="font-size:12px;font-weight:600;font-family:monospace;color:#4ade80">${total.cost.toFixed(2)} €</div>
        </div>
      </div>
      ${vehicleRows}
    </div>`
}

function makeMarkerIcon(operator, approximate, size=36) {
  const name = toLogoName(operator||'')
  const emoji = operatorEmoji(operator||'')
  const border = approximate ? '2px dashed rgba(255,255,255,0.5)' : '2.5px solid white'
  const opacity = approximate ? '0.75' : '1'

  // Try logo image, fallback to emoji
  const inner = name
    ? `<img src="/api/logos/${name}" style="width:${size-10}px;height:${size-10}px;object-fit:contain;border-radius:4px"
        onerror="this.style.display='none';this.nextSibling.style.display='flex'"
        /><span style="display:none;font-size:${size*0.4}px;line-height:1">${emoji}</span>`
    : `<span style="font-size:${size*0.4}px;line-height:1">${emoji}</span>`

  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1e2235;border:${border};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.5);opacity:${opacity};overflow:hidden">${inner}</div>`
}

export default function MapView({ charges, settings, theme }) {
  const mapRef  = useRef(null)
  const mapInst = useRef(null)
  const tileRef = useRef(null)
  const [ready,    setReady]    = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [mapStyle, setMapStyle] = useState(theme === 'light' ? 'light' : 'dark')

  useEffect(() => { loadLeaflet().then(() => setReady(true)) }, [])
  useEffect(() => { setMapStyle(theme === 'light' ? 'light' : 'dark') }, [theme])

  useEffect(() => {
    if (!ready || !mapInst.current) return
    const map = mapInst.current
    if (tileRef.current) map.removeLayer(tileRef.current)
    const t = TILE_LAYERS[mapStyle]
    tileRef.current = window.L.tileLayer(t.url, { attribution: t.attr, maxZoom:19 }).addTo(map)
  }, [ready, mapStyle])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (!mapInst.current) {
      mapInst.current = window.L.map(mapRef.current, { zoomControl:true }).setView([46.8, 2.3], 6)
      const t = TILE_LAYERS[mapStyle]
      tileRef.current = window.L.tileLayer(t.url, { attribution:t.attr, maxZoom:19 }).addTo(mapInst.current)
    }
    const map = mapInst.current
    map.eachLayer(l => { if (l instanceof window.L.Marker) map.removeLayer(l) })

    // Home marker
    if (settings?.homeLat && settings?.homeLng) {
      const homeIcon = window.L.divIcon({
        html:`<div style="width:32px;height:32px;border-radius:50%;background:#22c55e;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠</div>`,
        className:'', iconSize:[32,32], iconAnchor:[16,16],
      })
      window.L.marker([settings.homeLat, settings.homeLng], { icon:homeIcon })
        .addTo(map).bindPopup(`<b>Domicile</b><br>${settings.homeLabel||''}`)
    }

    // Filter + group
    const filtered = charges.filter(c => {
      if (filter !== 'all' && c.vehicleId !== filter) return false
      return c.lat && c.lng
    })
    const groups = groupByLocation(filtered)
    const bounds = []

    groups.forEach(group => {
      const markerHtml = makeMarkerIcon(group.operator, group.approximate)
      const icon = window.L.divIcon({ html:markerHtml, className:'', iconSize:[36,36], iconAnchor:[18,18] })
      window.L.marker([group.lat, group.lng], { icon })
        .addTo(map)
        .bindPopup(buildPopupHTML(group), { maxWidth:300, className:'ev-popup' })
      bounds.push([group.lat, group.lng])
    })

    if (bounds.length > 0) map.fitBounds(bounds, { padding:[40,40], maxZoom:14 })
  }, [ready, charges, filter, settings])

  useEffect(() => () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }, [])

  const withCoords = charges.filter(c => c.lat && c.lng)
  const tileOptions = [
    { id:'dark', label:'🌑 Sombre' },
    { id:'light', label:'☀️ Clair' },
    { id:'osm', label:'🗺️ OSM' },
  ]

  return (
    <div className="page fade-up" style={{ paddingBottom:0 }}>
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Carte</div>
      </div>

      <div style={{ display:'flex', gap:6, padding:'10px 16px 0', flexWrap:'wrap' }}>
        {[{id:'all',label:'Tous'},{id:'mg4',label:'MG4'},{id:'xpeng',label:'Xpeng G6'}].map(f => (
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{ padding:'5px 13px', borderRadius:20, fontSize:12, fontWeight:600, border:`1.5px solid ${filter===f.id?(f.id==='mg4'?'var(--mg4)':f.id==='xpeng'?'var(--xpeng)':'var(--accent)'):'var(--border)'}`, background:filter===f.id?`rgba(${f.id==='mg4'?'79,142,247':f.id==='xpeng'?'124,92,252':'79,142,247'},0.1)`:'var(--surface)', color:filter===f.id?(f.id==='mg4'?'var(--mg4)':f.id==='xpeng'?'var(--xpeng)':'var(--accent)'):'var(--muted)', cursor:'pointer' }}>{f.label}</button>
        ))}
        <div style={{ width:1, background:'var(--border)', margin:'4px 2px' }} />
        {tileOptions.map(t => (
          <button key={t.id} onClick={()=>setMapStyle(t.id)} style={{ padding:'5px 13px', borderRadius:20, fontSize:11, fontWeight:600, border:`1.5px solid ${mapStyle===t.id?'var(--accent)':'var(--border)'}`, background:mapStyle===t.id?'rgba(79,142,247,0.1)':'var(--surface)', color:mapStyle===t.id?'var(--accent)':'var(--muted)', cursor:'pointer' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ fontSize:11, color:'var(--muted)', padding:'6px 16px 0', display:'flex', gap:14 }}>
        <span>🔌 Borne exacte</span><span style={{ opacity:.6 }}>📍 Approx. (pointillés)</span>
      </div>

      <div style={{ margin:'10px 16px 0', borderRadius:'var(--r)', overflow:'hidden', border:'1px solid var(--border)', height:420 }}>
        {!ready ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface)', color:'var(--muted)', fontSize:13 }}>Chargement…</div>
        ) : withCoords.length === 0 ? (
          <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--surface)', color:'var(--muted)', fontSize:13, gap:8 }}>
            <span style={{ fontSize:32 }}>🗺️</span>Aucune session avec localisation.
          </div>
        ) : (
          <div ref={mapRef} style={{ width:'100%', height:'100%' }} />
        )}
      </div>

      {charges.length > 0 && (
        <div style={{ margin:'10px 16px 0', display:'flex', gap:8 }}>
          <div className="card" style={{ flex:1, padding:'12px 14px' }}>
            <div className="mono" style={{ fontSize:20, fontWeight:700, color:'var(--accent)' }}>{groupByLocation(withCoords).length}</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>Bornes distinctes</div>
          </div>
          <div className="card" style={{ flex:1, padding:'12px 14px' }}>
            <div className="mono" style={{ fontSize:20, fontWeight:700, color:'var(--muted)' }}>{charges.length - withCoords.length}</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>Sans localisation</div>
          </div>
        </div>
      )}
    </div>
  )
}
