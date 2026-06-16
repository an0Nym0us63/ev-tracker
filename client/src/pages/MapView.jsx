import React, { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { VEHICLES, getProviderStats } from '../utils.js'
import FilterSheet, { useFilters } from '../components/FilterSheet.jsx'

const TILE_LAYERS = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
}

function toLogoName(n='') { return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') }
function operatorEmoji(n='') {
  const map = { ionity:'⚡', totalenergies:'🔴', fastned:'🟠', tesla:'⚡', lidl:'🔵', izivia:'🔵', freshmile:'🟣', electra:'🟣', bump:'🟢', driveco:'🟢', wallbox:'🏠', v2c:'🏠', atlante:'🟡', zunder:'⚡' }
  const l = n.toLowerCase()
  const k = Object.keys(map).find(k => l.includes(k))
  return k ? map[k] : '🔌'
}

function groupByLocation(charges) {
  const groups = {}
  charges.forEach(c => {
    if (!c.lat || !c.lng) return
    const key = c.ocmId ? `ocm:${c.ocmId}` : `geo:${Math.round(c.lat*1000)/1000},${Math.round(c.lng*1000)/1000}`
    if (!groups[key]) groups[key] = { key, charges:[], lat:c.lat, lng:c.lng, label:c.locationName||c.provider||'Borne', operator:c.provider||'', approximate:c.locationApproximate, powerKw:c.powerKw }
    groups[key].charges.push(c)
  })
  return Object.values(groups)
}

function intensityColor(t) {
  const r = t<0.5 ? Math.round(79+t*2*(251-79)) : Math.round(251+(t-0.5)*2*(34-251))
  const g = t<0.5 ? Math.round(142+t*2*(191-142)) : Math.round(191+(t-0.5)*2*(197-191))
  const b = t<0.5 ? Math.round(247+t*2*(36-247)) : Math.round(36+(t-0.5)*2*(94-36))
  return `rgb(${r},${g},${b})`
}

function makeMarkerIcon(operator, approximate, intensity=0.5, size=40) {
  const name = toLogoName(operator||'')
  const emoji = operatorEmoji(operator||'')
  const color = intensityColor(intensity)
  const haloExtra = Math.round(6+intensity*14)
  const haloSize = size+haloExtra*2
  const haloOpacity = (0.35+intensity*0.5).toFixed(2)
  const border = approximate ? '2px dashed rgba(255,255,255,0.7)' : `3px solid ${color}`
  const inner = name
    ? `<img src="/api/logos/providers/${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${emoji}',style:'font-size:${Math.round(size*0.42)}px;line-height:1'}))" />`
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
    total.kwh+=c.kwh; total.cost+=c.totalCost||0; total.sessions++
    const v = VEHICLES[c.vehicleId]
    if (!byVehicle[c.vehicleId]) byVehicle[c.vehicleId] = { name:v.name, color:v.color, kwh:0, cost:0, sessions:0 }
    byVehicle[c.vehicleId].kwh+=c.kwh; byVehicle[c.vehicleId].cost+=c.totalCost||0; byVehicle[c.vehicleId].sessions++
  })
  const rows = Object.values(byVehicle).map(v => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(0,0,0,0.08)">
      <div style="width:8px;height:8px;border-radius:50%;background:${v.color};flex-shrink:0"></div>
      <div style="flex:1;font-size:11px;color:#475569">${v.name}</div>
      <div style="font-size:11px;font-family:monospace;color:#1e293b">${v.sessions}× · ${v.kwh.toFixed(1)} kWh · ${v.cost.toFixed(2)} €</div>
    </div>`).join('')
  return `<div style="min-width:220px;font-family:'Inter',sans-serif">
    <div style="font-weight:700;font-size:14px;margin-bottom:2px;color:#0f172a">${label}</div>
    ${operator?`<div style="font-size:11px;color:#475569;margin-bottom:6px">${operator}${powerKw?` · ${powerKw} kW`:''}</div>`:''}
    ${approximate?`<div style="font-size:10px;color:#d97706;margin-bottom:6px">📍 Position approximative</div>`:''}
    <div style="background:rgba(79,142,247,0.1);border-radius:8px;padding:8px 10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between">
        <div style="font-size:11px;color:#475569">${total.sessions} session${total.sessions>1?'s':''}</div>
        <div style="font-size:13px;font-weight:700;font-family:monospace;color:#2563eb">${total.kwh.toFixed(1)} kWh</div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:2px">
        <div style="font-size:12px;font-weight:600;font-family:monospace;color:#16a34a">${total.cost.toFixed(2)} €</div>
      </div>
    </div>
    ${rows}
  </div>`
}

function startOf(period) {
  const now = new Date()
  if (period==='today')   return now.toISOString().slice(0,10)
  if (period==='week')    { const d=new Date(now); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10) }
  if (period==='month')   return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  if (period==='3months') { const d=new Date(now); d.setMonth(d.getMonth()-3); return d.toISOString().slice(0,10) }
  if (period==='year')    return `${now.getFullYear()}-01-01`
  return null
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

export default function MapView({ charges, settings, theme }) {
  const mapRef  = useRef(null)
  const mapInst = useRef(null)
  const tileRef = useRef(null)
  const [ready, setReady] = useState(false)
  const { filters, setFilters, showFilters, setShowFilters, applyFilters, activeCount } = useFilters()
  const mapStyle = theme === 'light' ? 'light' : 'dark'
  const today = new Date().toISOString().slice(0,10)
  const providers = useMemo(() => [...new Set(charges.filter(c=>c.provider).map(c=>c.provider))].sort((a,b)=>a.localeCompare(b,'fr')), [charges])
  const cards = useMemo(() => [...new Set(charges.filter(c=>c.card).map(c=>c.card))].sort((a,b)=>a.localeCompare(b,'fr')), [charges])

  useEffect(() => { loadLeaflet().then(() => setReady(true)) }, [])

  const filtered = useMemo(() => applyFilters(charges).filter(c => c.lat && c.lng), [charges, filters])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (!mapInst.current) {
      mapInst.current = window.L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([46.8, 2.3], 6)
    }
    const map = mapInst.current
    if (tileRef.current) { map.removeLayer(tileRef.current) }
    tileRef.current = window.L.tileLayer(TILE_LAYERS[mapStyle]||TILE_LAYERS.dark, { maxZoom:19 }).addTo(map)
  }, [ready, mapStyle])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (!mapInst.current) return
    const map = mapInst.current
    // Remove only markers, never tile layers
    map.eachLayer(l => { if (l instanceof window.L.Marker) map.removeLayer(l) })

    if (settings?.homeLat && settings?.homeLng) {
      const icon = window.L.divIcon({ html:`<div style="width:32px;height:32px;border-radius:50%;background:#22c55e;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠</div>`, className:'', iconSize:[32,32], iconAnchor:[16,16] })
      window.L.marker([settings.homeLat, settings.homeLng], { icon }).addTo(map).bindPopup(`<b>Domicile</b><br>${settings.homeLabel||''}`)
    }

    const groups = groupByLocation(filtered)
    const bounds = []
    const kwhValues = groups.map(g => g.charges.reduce((s,c)=>s+c.kwh,0))
    const minKwh = kwhValues.length ? Math.min(...kwhValues) : 0
    const maxKwh = kwhValues.length ? Math.max(...kwhValues) : 1
    const range = maxKwh - minKwh

    groups.forEach((group, i) => {
      const intensity = range === 0 ? 1 : (kwhValues[i] - minKwh) / range
      const haloExtra = Math.round(6 + intensity * 14)
      const haloSize = 40 + haloExtra * 2
      const icon = window.L.divIcon({ html:makeMarkerIcon(group.operator, group.approximate, intensity), className:'', iconSize:[haloSize,haloSize], iconAnchor:[haloSize/2,haloSize/2] })
      window.L.marker([group.lat, group.lng], { icon, zIndexOffset: Math.round(intensity * 1000) }).addTo(map).bindPopup(buildPopupHTML(group), { maxWidth:300 })
      bounds.push([group.lat, group.lng])
    })

    if (bounds.length > 0) map.fitBounds(bounds, { padding:[40,40], maxZoom:13, animate:false })
  }, [ready, filtered, settings])

  useEffect(() => () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }, [])

  const withCoords = charges.filter(c => c.lat && c.lng)
  const groups = groupByLocation(filtered)
  const totalKwh = filtered.reduce((s,c)=>s+c.kwh,0)
  const totalCost = filtered.reduce((s,c)=>s+(c.totalCost||0),0)

  return (
    <div className="page fade-up" style={{ paddingBottom:80 }}>

      {/* Header */}
      <div style={{ padding:'16px 20px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Carte</div>
        <button onClick={()=>setShowFilters(true)} style={{
          display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
          borderRadius:20, border:`1.5px solid ${activeCount>0?'var(--accent)':'var(--border)'}`,
          background: activeCount>0 ? 'rgba(79,142,247,0.1)' : 'var(--surface)',
          color: activeCount>0 ? 'var(--accent)' : 'var(--muted)',
          fontSize:13, fontWeight:600, cursor:'pointer'
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtres{activeCount>0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      {/* Map — full width, no margin */}
      <div style={{ position:'relative', height:'65vh', minHeight:400, overflow:'hidden', border:'1px solid var(--border)', margin:'0 16px', borderRadius:'var(--r)' }}>
        {!ready ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface)', color:'var(--muted)', fontSize:13 }}>Chargement…</div>
        ) : withCoords.length === 0 ? (
          <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--surface)', color:'var(--muted)', fontSize:13, gap:8 }}>
            <span style={{ fontSize:32 }}>🗺️</span>Aucune session avec localisation.
          </div>
        ) : (
          <div ref={mapRef} style={{ width:'100%', height:'100%' }} />
        )}

        {/* Legend overlay */}
        <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', borderRadius:8, padding:'4px 10px', display:'flex', gap:8, alignItems:'center', fontSize:10, color:'white', zIndex:1000, pointerEvents:'none' }}>
          <span style={{ opacity:.7 }}>📍 Approx.</span>
          <div style={{ width:1, height:10, background:'rgba(255,255,255,0.3)' }} />
          {[['#4f8ef7','faible'],['#fbbf24','moyen'],['#22c55e','fort']].map(([c,l]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:c }} />
              <span style={{ opacity:.8 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      {charges.length > 0 && (() => {
        const avgPrice = totalKwh > 0 && totalCost > 0 ? totalCost/totalKwh : null
        const approxCount = groups.filter(g=>g.approximate).length
        const exactCount  = groups.filter(g=>!g.approximate).length
        const mg4Sessions   = filtered.filter(c=>c.vehicleId==='mg4').length
        const xpengSessions = filtered.filter(c=>c.vehicleId==='xpeng').length
        const kpis = [
          { val:groups.length,                    label:'Bornes',        color:'var(--accent)' },
          { val:exactCount+' / '+approxCount,     label:'Exactes / Approx', color:'var(--muted)' },
          { val:filtered.length,                  label:'Sessions',      color:'var(--text)' },
          { val:totalKwh.toFixed(0)+' kWh',       label:'Total kWh',    color:'var(--mg4)', mono:true },
          { val:totalCost.toFixed(2)+' €',        label:'Total coût',   color:'var(--green)', mono:true },
          { val:avgPrice?avgPrice.toFixed(3):'—', label:'€/kWh moy.',   color:'var(--muted)', mono:true },
          { val:mg4Sessions,                       label:'Sessions MG4', color:'var(--mg4)' },
          { val:xpengSessions,                     label:'Sessions G6',  color:'var(--xpeng)' },
          { val:new Set(filtered.map(c=>c.provider).filter(Boolean)).size, label:'Fournisseurs', color:'var(--xpeng)' },
          { val:filtered.length > 0 ? (totalKwh/filtered.length).toFixed(1) : '—', label:'kWh/session', color:'var(--accent)', mono:true },
        ]
        return (
          <div style={{ margin:'10px 16px 0', display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
            {kpis.map(s => (
              <div key={s.label} className="card" style={{ padding:'8px 10px' }}>
                <div className={s.mono?'mono':''} style={{ fontSize:10, fontWeight:700, color:s.color, lineHeight:1.2 }}>{s.val}</div>
                <div style={{ fontSize:8.5, color:'var(--muted)', marginTop:3, lineHeight:1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {showFilters && (
        <FilterSheet onClose={()=>setShowFilters(false)} filters={filters} setFilters={setFilters}
          config={{ showLocation:true, providers, cards }} />
      )}
    </div>
  )
}
