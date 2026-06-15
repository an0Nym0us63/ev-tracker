import React, { useEffect, useRef, useState, useMemo } from 'react'
import { VEHICLES } from '../utils.js'

const TILE_LAYERS = {
  dark:  { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap © CARTO' },
  light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap © CARTO' },
  osm:   { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
}

const OPERATOR_EMOJIS = {
  ionity:'🦅', totalenergies:'🔴', total:'🔴', fastned:'🟠', tesla:'⚡',
  lidl:'🔵', leclerc:'🔵', engie:'🟢', izivia:'🔵', freshmile:'🟣',
  electra:'🟣', bump:'🟢', driveco:'🟢', powerdot:'🔵', chargemap:'🔵',
  v2c:'🏠', wallbox:'🏠', trydan:'🏠',
}
function operatorEmoji(name='') {
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

// intensity 0..1 → color
function intensityColor(t) {
  // 0=blue, 0.5=amber, 1=green — simpler: blue→green with amber mid
  const r = t < 0.5 ? Math.round(79 + t*2*(251-79)) : Math.round(251 + (t-0.5)*2*(34-251))
  const g = t < 0.5 ? Math.round(142 + t*2*(191-142)) : Math.round(191 + (t-0.5)*2*(197-191))
  const b = t < 0.5 ? Math.round(247 + t*2*(36-247)) : Math.round(36 + (t-0.5)*2*(94-36))
  return `rgb(${r},${g},${b})`
}

function makeMarkerIcon(operator, approximate, intensity=0.5, size=40) {
  const name = toLogoName(operator||'')
  const emoji = operatorEmoji(operator||'')
  const color = intensityColor(intensity)
  // Halo: always visible, size and opacity scale with intensity
  const haloExtra = Math.round(6 + intensity * 14) // 6px → 20px extra
  const haloSize  = size + haloExtra * 2
  const haloOpacity = (0.35 + intensity * 0.5).toFixed(2)
  const border = approximate ? '2px dashed rgba(255,255,255,0.7)' : `3px solid ${color}`

  const inner = name
    ? `<img src="/api/logos/providers/${name}"
        style="width:100%;height:100%;object-fit:cover;border-radius:50%"
        onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${emoji}',style:'font-size:${Math.round(size*0.42)}px;line-height:1'}))"
      />`
    : `<span style="font-size:${Math.round(size*0.42)}px;line-height:1">${emoji}</span>`

  return `<div style="position:relative;width:${haloSize}px;height:${haloSize}px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:${haloOpacity};filter:blur(${Math.round(4+intensity*6)}px)"></div>
    <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:#1e2235;border:${border};display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${inner}</div>
  </div>`
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
      <div style="flex:1;font-size:11px;color:#475569">${v.name}</div>
      <div style="font-size:11px;font-family:monospace;color:#1e293b">${v.sessions}× · ${v.kwh.toFixed(1)} kWh · ${v.cost.toFixed(2)} €</div>
    </div>`).join('')
  return `
    <div style="min-width:220px;font-family:'Inter',sans-serif">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px;color:#0f172a">${label}</div>
      ${operator ? `<div style="font-size:11px;color:#475569;margin-bottom:6px">${operator}${powerKw?` · ${powerKw} kW`:''}</div>` : ''}
      ${approximate ? `<div style="font-size:10px;color:#d97706;margin-bottom:6px">📍 Position approximative</div>` : ''}
      <div style="background:rgba(79,142,247,0.12);border-radius:8px;padding:8px 10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <div style="font-size:11px;color:#475569">${total.sessions} session${total.sessions>1?'s':''}</div>
          <div style="font-size:13px;font-weight:700;font-family:monospace;color:#2563eb">${total.kwh.toFixed(1)} kWh</div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:2px">
          <div style="font-size:12px;font-weight:600;font-family:monospace;color:#16a34a">${total.cost.toFixed(2)} €</div>
        </div>
      </div>
      ${vehicleRows}
    </div>`
}

// Date filter helpers
function startOf(period) {
  const now = new Date()
  if (period === 'today')  return now.toISOString().slice(0,10)
  if (period === 'week')   { const d=new Date(now); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10) }
  if (period === 'month')  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  if (period === 'year')   return `${now.getFullYear()}-01-01`
  if (period === '3months'){ const d=new Date(now); d.setMonth(d.getMonth()-3); return d.toISOString().slice(0,10) }
  return null
}

const PERIOD_LABELS = [
  { id:'all', label:"Tout" },
  { id:'year', label:"Cette année" },
  { id:'3months', label:"3 mois" },
  { id:'month', label:"Ce mois" },
  { id:'week', label:"Cette semaine" },
  { id:'today', label:"Aujourd'hui" },
  { id:'custom', label:"📅 Plage" },
]

export default function MapView({ charges, settings, theme }) {
  const mapRef  = useRef(null)
  const mapInst = useRef(null)
  const tileRef = useRef(null)
  const [ready,    setReady]    = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [mapStyle, setMapStyle] = useState(theme === 'light' ? 'light' : 'dark')
  const [period,   setPeriod]   = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => { loadLeaflet().then(() => setReady(true)) }, [])
  useEffect(() => { setMapStyle(theme === 'light' ? 'light' : 'dark') }, [theme])

  useEffect(() => {
    if (!ready || !mapInst.current) return
    const map = mapInst.current
    if (tileRef.current) map.removeLayer(tileRef.current)
    const t = TILE_LAYERS[mapStyle]
    tileRef.current = window.L.tileLayer(t.url, { attribution:t.attr, maxZoom:19 }).addTo(map)
  }, [ready, mapStyle])

  // Filtered charges
  const filtered = useMemo(() => {
    return charges.filter(c => {
      if (filter !== 'all' && c.vehicleId !== filter) return false
      if (period === 'custom') {
        if (customFrom && c.date < customFrom) return false
        if (customTo   && c.date > customTo)   return false
      } else {
        const from = startOf(period)
        if (from && c.date < from) return false
      }
      return c.lat && c.lng
    })
  }, [charges, filter, period, customFrom, customTo])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (!mapInst.current) {
      mapInst.current = window.L.map(mapRef.current, { zoomControl:true }).setView([46.8, 2.3], 6)
      const t = TILE_LAYERS[mapStyle]
      tileRef.current = window.L.tileLayer(t.url, { attribution:t.attr, maxZoom:19 }).addTo(mapInst.current)
    }
    const map = mapInst.current
    map.eachLayer(l => { if (l instanceof window.L.Marker) map.removeLayer(l) })

    if (settings?.homeLat && settings?.homeLng) {
      const homeIcon = window.L.divIcon({
        html:`<div style="width:32px;height:32px;border-radius:50%;background:#22c55e;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠</div>`,
        className:'', iconSize:[32,32], iconAnchor:[16,16],
      })
      window.L.marker([settings.homeLat, settings.homeLng], { icon:homeIcon })
        .addTo(map).bindPopup(`<b>Domicile</b><br>${settings.homeLabel||''}`)
    }

    const groups = groupByLocation(filtered)
    const bounds = []

    // Compute kWh per group for intensity
    const kwhValues = groups.map(g => g.charges.reduce((s,c)=>s+c.kwh,0))
    const minKwh = kwhValues.length ? Math.min(...kwhValues) : 0
    const maxKwh = kwhValues.length ? Math.max(...kwhValues) : 1
    const range  = maxKwh - minKwh

    groups.forEach((group, i) => {
      const totalKwh = kwhValues[i]
      // Single marker or all equal → green (max usage in current filter)
      const intensity = range === 0 ? 1 : (totalKwh - minKwh) / range
      const haloExtra = Math.round(6 + intensity * 14)
      const haloSize  = 40 + haloExtra * 2
      const markerHtml = makeMarkerIcon(group.operator, group.approximate, intensity)
      const icon = window.L.divIcon({ html:markerHtml, className:'', iconSize:[haloSize,haloSize], iconAnchor:[haloSize/2,haloSize/2] })
      window.L.marker([group.lat, group.lng], { icon })
        .addTo(map)
        .bindPopup(buildPopupHTML(group), { maxWidth:300 })
      bounds.push([group.lat, group.lng])
    })

    if (bounds.length > 0) map.fitBounds(bounds, { padding:[40,40], maxZoom:14 })
  }, [ready, filtered, settings])

  useEffect(() => () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }, [])

  const withCoords = charges.filter(c => c.lat && c.lng)
  const chip = (active, label, onClick, color='var(--accent)') => (
    <button onClick={onClick} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0,
      border:`1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? `rgba(79,142,247,0.12)` : 'var(--surface)',
      color: active ? color : 'var(--muted)', cursor:'pointer', whiteSpace:'nowrap' }}>{label}</button>
  )

  const today = new Date().toISOString().slice(0,10)

  return (
    <div className="page fade-up" style={{ paddingBottom:0 }}>
      <div style={{ padding:'16px 20px 8px' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Carte</div>
      </div>

      {/* Vehicle filter */}
      <div style={{ display:'flex', gap:6, padding:'0 16px', overflowX:'auto', scrollbarWidth:'none' }}>
        {[{id:'all',label:'Tous'},{id:'mg4',label:'MG4'},{id:'xpeng',label:'Xpeng G6'}].map(f =>
          chip(filter===f.id, f.label, ()=>setFilter(f.id), f.id==='mg4'?'var(--mg4)':f.id==='xpeng'?'var(--xpeng)':'var(--accent)')
        )}
        <div style={{ width:1, background:'var(--border)', margin:'4px 2px', flexShrink:0 }} />
        {[
          { id:'dark', label:'🌑' },
          { id:'light', label:'☀️' },
          { id:'osm', label:'🗺️' },
        ].map(t => chip(mapStyle===t.id, t.label, ()=>setMapStyle(t.id)))}
      </div>

      {/* Period filter */}
      <div style={{ display:'flex', gap:6, padding:'8px 16px 0', overflowX:'auto', scrollbarWidth:'none' }}>
        {PERIOD_LABELS.map(p =>
          chip(period===p.id, p.label, () => {
            if (p.id === 'custom') { setShowCustom(s=>!s); setPeriod('custom') }
            else { setPeriod(p.id); setShowCustom(false) }
          })
        )}
      </div>

      {/* Custom date range */}
      {showCustom && (
        <div style={{ display:'flex', gap:8, padding:'8px 16px 0', alignItems:'center' }}>
          <input type="date" value={customFrom} max={customTo||today} onChange={e=>setCustomFrom(e.target.value)}
            style={{ flex:1, background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'8px 10px', fontSize:13, color:'var(--text)', colorScheme:'dark', fontFamily:"'JetBrains Mono',monospace" }} />
          <span style={{ color:'var(--muted)', fontSize:12, flexShrink:0 }}>→</span>
          <input type="date" value={customTo} min={customFrom} max={today} onChange={e=>setCustomTo(e.target.value)}
            style={{ flex:1, background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'8px 10px', fontSize:13, color:'var(--text)', colorScheme:'dark', fontFamily:"'JetBrains Mono',monospace" }} />
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:14, padding:'6px 16px 0', fontSize:11, color:'var(--muted)', alignItems:'center' }}>
        <span>🔌 Exacte</span>
        <span style={{ opacity:.6 }}>📍 Approx.</span>
        <div style={{ display:'flex', gap:3, alignItems:'center', marginLeft:'auto' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#4f8ef7' }}/>
          <span>faible</span>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#fbbf24', marginLeft:4 }}/>
          <span>moyen</span>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', marginLeft:4 }}/>
          <span>fort</span>
        </div>
      </div>

      <div style={{ margin:'8px 16px 0', borderRadius:'var(--r)', overflow:'hidden', border:'1px solid var(--border)', height:400 }}>
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

      {charges.length > 0 && (() => {
        const groups = groupByLocation(filtered)
        const operators = new Set(filtered.map(c=>c.provider).filter(Boolean))
        const totalKwh  = filtered.reduce((s,c)=>s+c.kwh,0)
        const totalCost = filtered.reduce((s,c)=>s+(c.totalCost||0),0)
        const stats = [
          { val: groups.length,            label:'Bornes',     color:'var(--accent)' },
          { val: operators.size,            label:'Fournisseurs', color:'var(--xpeng)' },
          { val: filtered.length,           label:'Sessions',   color:'var(--text)' },
          { val: totalKwh.toFixed(0)+' kWh', label:'Total kWh', color:'var(--mg4)', mono:true },
          { val: totalCost.toFixed(2)+' €',  label:'Total coût', color:'var(--green)', mono:true },
        ]
        return (
          <div style={{ margin:'8px 16px 0', display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
            {stats.map(s => (
              <div key={s.label} className="card" style={{ padding:'8px 10px' }}>
                <div className={s.mono?'mono':''} style={{ fontSize:s.mono?11:18, fontWeight:700, color:s.color, lineHeight:1.2 }}>{s.val}</div>
                <div style={{ fontSize:9, color:'var(--muted)', marginTop:3, lineHeight:1.2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
