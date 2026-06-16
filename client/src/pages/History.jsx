import React, { useMemo } from 'react'
import { VEHICLES, LOCATIONS, formatDuration } from '../utils.js'
import OperatorLogo from '../components/OperatorLogo.jsx'
import FilterSheet, { useFilters } from '../components/FilterSheet.jsx'

export default function History({ charges, onEdit }) {
  const { filters, setFilters, showFilters, setShowFilters, applyFilters, activeCount } = useFilters()

  const providers = useMemo(() => [...new Set(charges.filter(c=>c.provider).map(c=>c.provider))].sort((a,b)=>a.localeCompare(b,'fr')), [charges])
  const cards = useMemo(() => [...new Set(charges.filter(c=>c.card).map(c=>c.card))].sort((a,b)=>a.localeCompare(b,'fr')), [charges])

  const filtered = useMemo(() => applyFilters(charges), [charges, filters])

  const totalKwh  = filtered.reduce((s,c) => s + c.kwh, 0)
  const totalCost = filtered.reduce((s,c) => s + c.totalCost, 0)

  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach(c => { const k = c.date.slice(0,7); (g[k]=g[k]||[]).push(c) })
    return Object.entries(g)
      .sort((a,b) => b[0].localeCompare(a[0]))
      .map(([k, items]) => [k, items.sort((a,b) => b.date.localeCompare(a.date))])
  }, [filtered])



  function monthLabel(key) {
    const [y,m] = key.split('-')
    const s = new Date(+y,+m-1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})
    return s.charAt(0).toUpperCase()+s.slice(1)
  }

  return (
    <div className="page fade-up">
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Historique</div>
      </div>

      {/* Filter button */}
      <div style={{ padding:'10px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:12, color:'var(--muted)' }}>{filtered.length} session{filtered.length!==1?'s':''}</div>
        <button onClick={()=>setShowFilters(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${activeCount>0?'var(--accent)':'var(--border)'}`, background:activeCount>0?'rgba(79,142,247,0.1)':'var(--surface)', color:activeCount>0?'var(--accent)':'var(--muted)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          Filtres{activeCount>0?` (${activeCount})`:''}
        </button>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div style={{ margin:'8px 16px 0', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span className="mono" style={{ fontSize:13, fontWeight:700 }}>{totalKwh.toFixed(0)} kWh</span>
          <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>{totalCost.toFixed(2)} €</span>
        </div>
      )}

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:20 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted)', fontSize:13 }}>Aucune session pour ces filtres.</div>
        )}

        {grouped.map(([key, items]) => {
          const mKwh  = items.reduce((s,c)=>s+c.kwh,0)
          const mCost = items.reduce((s,c)=>s+c.totalCost,0)
          return (
            <div key={key}>
              {/* Month header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'capitalize' }}>{monthLabel(key)}</span>
                <div style={{ display:'flex', gap:10 }}>
                  <span className="mono" style={{ fontSize:11, color:'var(--muted)' }}>{mKwh.toFixed(0)} kWh</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{mCost.toFixed(2)} €</span>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {items.map(c => {
                  const v   = VEHICLES[c.vehicleId] || { color:'var(--muted)', name:'?', emoji:'🚗' }
                  const loc = LOCATIONS[c.locationId]
                  const day = new Date(c.date+'T00:00:00')
                  const isHome = c.locationId === 'home'

                  return (
                    <div key={c.id} onClick={() => onEdit(c)}
                      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', cursor:'pointer', overflow:'hidden', display:'flex' }}>

                      {/* Left accent bar */}
                      <div style={{ width:3, background:v.color, flexShrink:0 }} />

                      {/* Logo column */}
                      <div style={{ width:56, display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 6px', flexShrink:0 }}>
                        <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <OperatorLogo name={c.locationId==='home' ? (c.provider||'v2c') : (c.provider||'')} size={40} style={{ width:40, height:40, borderRadius:10, objectFit:'cover' }} />
                        </div>
                      </div>

                      {/* Main content */}
                      <div style={{ flex:1, minWidth:0, padding:'10px 0 10px 0' }}>
                        {/* Row 1: vehicle + provider tag */}
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:v.color }}>{v.name}</span>
                          {c.provider && (
                            <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:20,
                              background: isHome ? 'rgba(34,197,94,0.1)' : 'rgba(79,142,247,0.1)',
                              color: isHome ? 'var(--green)' : 'var(--accent)',
                              border: `1px solid ${isHome ? 'rgba(34,197,94,0.2)' : 'rgba(79,142,247,0.2)'}` }}>
                              {c.provider}
                            </span>
                          )}
                        </div>
                        {/* Row 2: details */}
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, display:'flex', flexWrap:'wrap', gap:'0 6px' }}>
                          {c.durationMin ? <span>{formatDuration(c.durationMin)}</span> : null}
                          {c.powerKw ? <span>{c.powerKw} kW</span> : null}
                          {(c.connectorTypes||[]).length > 0 ? <span>{c.connectorTypes.join(', ')}</span> : null}
                          {c.card ? <span>{c.card}</span> : null}
                        </div>
                      </div>

                      {/* Right: date + kWh + cost */}
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'center', padding:'10px 14px 10px 8px', flexShrink:0, gap:2 }}>
                        <div style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>
                          {day.getDate()} {day.toLocaleDateString('fr-FR',{month:'short'})}
                          {c.startTime && <span style={{ marginLeft:4, fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}>{c.startTime}</span>}
                        </div>
                        <div className="mono" style={{ fontSize:15, fontWeight:700 }}>{c.kwh} kWh</div>
                        <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                          <span className="mono" style={{ fontSize:12, fontWeight:600, color: isHome ? 'var(--green)' : 'var(--amber)' }}>{c.totalCost.toFixed(2)} €</span>
                          {c.fuelSavings != null && <span style={{ fontSize:9, fontWeight:600, color: c.fuelSavings >= 0 ? 'var(--green)' : 'var(--red)', opacity:0.8 }}>{c.fuelSavings >= 0 ? '+' : '-'}{Math.abs(c.fuelSavings).toFixed(0)}€</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    {showFilters && (
        <FilterSheet
          onClose={()=>setShowFilters(false)}
          filters={filters} setFilters={setFilters}
          config={{ showLocation:true, providers, cards }}
        />
      )}
    </div>
  )
}
