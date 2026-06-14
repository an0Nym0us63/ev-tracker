import React, { useState, useMemo } from 'react'
import { VEHICLES, LOCATIONS, formatDate, formatDuration, formatCost } from '../utils.js'

export default function History({ charges, onEdit }) {
  const [vf, setVf] = useState('all')
  const [lf, setLf] = useState('all')

  const filtered = useMemo(() => charges.filter(c => {
    if (vf !== 'all' && c.vehicleId !== vf) return false
    if (lf === 'home' && c.locationId !== 'home') return false
    if (lf === 'ext'  && c.locationId === 'home') return false
    return true
  }), [charges, vf, lf])

  const totalKwh  = filtered.reduce((s,c) => s + c.kwh, 0)
  const totalCost = filtered.reduce((s,c) => s + c.totalCost, 0)

  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach(c => { const k = c.date.slice(0,7); (g[k]=g[k]||[]).push(c) })
    return Object.entries(g).sort((a,b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const VF = [{id:'all',label:'Tous'},{id:'mg4',label:'MG4'},{id:'xpeng',label:'Xpeng G6'}]
  const LF = [{id:'all',label:'Tous lieux'},{id:'home',label:'🏠 Maison'},{id:'ext',label:'📍 Externe'}]

  function chipStyle(active, color = 'var(--accent)') {
    return {
      flexShrink: 0, padding: '5px 13px', borderRadius: 20,
      border: `1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? `rgba(${color === 'var(--mg4)' ? '79,142,247' : color === 'var(--xpeng)' ? '124,92,252' : '79,142,247'},0.1)` : 'var(--surface)',
      color: active ? color : 'var(--muted)',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
    }
  }

  function monthLabel(key) {
    const [y,m] = key.split('-')
    const s = new Date(+y,+m-1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})
    return s.charAt(0).toUpperCase()+s.slice(1)
  }

  return (
    <div className="page fade-up">
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Historique</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {VF.map(f => (
          <button key={f.id} onClick={() => setVf(f.id)}
            style={chipStyle(vf===f.id, f.id==='mg4'?'var(--mg4)':f.id==='xpeng'?'var(--xpeng)':'var(--accent)')}>
            {f.label}
          </button>
        ))}
        <div style={{ width:1, background:'var(--border)', flexShrink:0, margin:'4px 2px' }} />
        {LF.map(f => (
          <button key={f.id} onClick={() => setLf(f.id)} style={chipStyle(lf===f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div style={{ margin:'10px 16px 0', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--muted)' }}>{filtered.length} session{filtered.length>1?'s':''}</span>
          <div style={{ display:'flex', gap:16 }}>
            <span className="mono" style={{ fontSize:13, fontWeight:700 }}>{totalKwh.toFixed(0)} kWh</span>
            <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>{totalCost.toFixed(2)} €</span>
          </div>
        </div>
      )}

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:20 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted)', fontSize:13 }}>Aucune session pour ces filtres.</div>
        )}

        {grouped.map(([key, items]) => {
          const mKwh = items.reduce((s,c)=>s+c.kwh,0)
          const mCost = items.reduce((s,c)=>s+c.totalCost,0)
          return (
            <div key={key}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'capitalize' }}>{monthLabel(key)}</span>
                <div style={{ display:'flex', gap:10 }}>
                  <span className="mono" style={{ fontSize:11, color:'var(--muted)' }}>{mKwh.toFixed(0)} kWh</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{mCost.toFixed(2)} €</span>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {items.map(c => {
                  const v = VEHICLES[c.vehicleId]
                  const loc = LOCATIONS[c.locationId]
                  return (
                    <div key={c.id} onClick={() => onEdit(c)} style={{
                      background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)',
                      padding:'12px 14px', display:'flex', alignItems:'center', gap:12,
                      cursor:'pointer', position:'relative', overflow:'hidden',
                    }}>
                      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:v.color }} />

                      <div style={{ textAlign:'center', minWidth:32, paddingLeft:4 }}>
                        <div className="mono" style={{ fontSize:18, fontWeight:700, lineHeight:1 }}>
                          {new Date(c.date+'T00:00:00').getDate()}
                        </div>
                        <div style={{ fontSize:9, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.05em' }}>
                          {new Date(c.date+'T00:00:00').toLocaleDateString('fr-FR',{month:'short'})}
                        </div>
                      </div>

                      <div style={{ width:1, background:'var(--border)', alignSelf:'stretch' }} />

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:600 }}>{v.name}</span>
                          <span className={`badge ${loc.badgeClass}`}>{loc.emoji} {c.provider || c.locationName || loc.label}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                          {c.durationMin ? formatDuration(c.durationMin) : '—'}
                          {c.powerKw ? ` · ${c.powerKw} kW` : ''}
                          {(c.connectorTypes||[]).length > 0 ? ` · ${c.connectorTypes.join(', ')}` : ''}
                          {c.card ? ` · ${c.card}` : ''}
                          {c.odometer ? ` · ${c.odometer.toLocaleString('fr-FR')} km` : ''}
                        </div>
                      </div>

                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div className="mono" style={{ fontSize:15, fontWeight:700 }}>{c.kwh} kWh</div>
                        <div className="mono" style={{ fontSize:11, fontWeight:600, marginTop:2, color: c.locationId!=='home' ? 'var(--amber)' : 'var(--green)' }}>
                          {c.totalCost.toFixed(2)} €
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
    </div>
  )
}
