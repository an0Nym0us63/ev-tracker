import React from 'react'
import { createPortal } from 'react-dom'
import OperatorLogo from './OperatorLogo.jsx'
import CardLogo from './CardLogo.jsx'

function Chip({ active, label, onClick, color='var(--accent)' }) {
  return (
    <button onClick={onClick} style={{
      padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0,
      border:`1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? `${color}18` : 'var(--surface)',
      color: active ? color : 'var(--muted)',
      cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.12s',
    }}>{label}</button>
  )
}

function LogoChip({ active, label, onClick, logo, color='var(--accent)' }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:6,
      padding:'5px 12px 5px 6px', borderRadius:20, fontSize:11.5, fontWeight:active?600:500, flexShrink:0,
      border:`1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? `${color}18` : 'var(--surface)',
      color: active ? color : 'var(--muted)',
      cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.12s',
    }}>
      {logo}
      <span style={{ opacity: active ? 1 : 0.8 }}>{label}</span>
    </button>
  )
}

function MultiSelect({ label, options, selected, onChange, color='var(--accent)' }) {
  const allSelected = selected.length === 0 // empty = all
  function toggle(val) {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <Chip active={allSelected} label="Tous" onClick={()=>onChange([])} color={color} />
        {options.map(o => (
          <Chip key={o} active={selected.includes(o)} label={o} onClick={()=>toggle(o)} color={color} />
        ))}
      </div>
    </div>
  )
}

function LogoMultiSelect({ label, options, selected, onChange, type='provider', color='var(--accent)' }) {
  const allSelected = selected.length === 0
  function toggle(val) {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }
  const LogoComp = type === 'card' ? CardLogo : OperatorLogo
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <Chip active={allSelected} label="Tous" onClick={()=>onChange([])} color={color} />
        {options.map(o => (
          <LogoChip key={o} active={selected.includes(o)} label={o} color={color}
            logo={<LogoComp name={o} size={14} />}
            onClick={()=>toggle(o)} />
        ))}
      </div>
    </div>
  )
}

export default function FilterSheet({ onClose, filters, setFilters, config }) {
  const today = new Date().toISOString().slice(0,10)
  const { period, customFrom, customTo, vehicles, providers, cards, locations } = filters

  function reset() {
    setFilters({ period:'all', customFrom:'', customTo:'', vehicles:[], providers:[], cards:[], locations:[] })
  }

  const activeCount = [
    period !== 'all',
    vehicles.length > 0,
    providers.length > 0,
    cards.length > 0,
    locations.length > 0,
  ].filter(Boolean).length

  const periods = [
    { id:'all', l:'Tout' },
    { id:'month', l:'Ce mois' },
    { id:'year', l:'Cette année' },
    { id:'30d', l:'30 jours' },
    { id:'12m', l:'12 mois' },
    { id:'custom', l:'📅 Plage' },
  ]

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500 }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderRadius:'20px 20px 0 0', zIndex:501, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.4)', animation:'slideUp 0.2s ease' }}>

        <div style={{ padding:'14px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>Filtres{activeCount > 0 ? ` (${activeCount})` : ''}</div>
          <div style={{ display:'flex', gap:8 }}>
            {activeCount > 0 && (
              <button onClick={reset} style={{ fontSize:12, color:'var(--red)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Réinitialiser</button>
            )}
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:'var(--surface2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16 }}>×</button>
          </div>
        </div>

        <div style={{ overflowY:'auto', padding:'16px 16px 32px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Period */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Période</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {periods.map(p => <Chip key={p.id} active={period===p.id} label={p.l} onClick={()=>setFilters(f=>({...f,period:p.id}))} />)}
            </div>
            {period==='custom' && (
              <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
                <input type="date" value={customFrom} max={customTo||today} onChange={e=>setFilters(f=>({...f,customFrom:e.target.value}))}
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'8px 10px', fontSize:13, color:'var(--text)', colorScheme:'dark' }} />
                <span style={{ color:'var(--muted)', flexShrink:0 }}>→</span>
                <input type="date" value={customTo} min={customFrom} max={today} onChange={e=>setFilters(f=>({...f,customTo:e.target.value}))}
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'8px 10px', fontSize:13, color:'var(--text)', colorScheme:'dark' }} />
              </div>
            )}
          </div>

          {/* Vehicle — multi */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Véhicule</div>
            <div style={{ display:'flex', gap:6 }}>
              <Chip active={vehicles.length===0} label="Tous" onClick={()=>setFilters(f=>({...f,vehicles:[]}))} />
              {[{id:'mg4',label:'MG4',color:'var(--mg4)'},{id:'xpeng',label:'Xpeng G6',color:'var(--xpeng)'}].map(v => (
                <Chip key={v.id} active={vehicles.includes(v.id)} label={v.label} color={v.color}
                  onClick={()=>setFilters(f=>({...f,vehicles:f.vehicles.includes(v.id)?f.vehicles.filter(x=>x!==v.id):[...f.vehicles,v.id]}))} />
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Lieu</div>
            <div style={{ display:'flex', gap:6 }}>
              <Chip active={locations.length===0} label="Tous" onClick={()=>setFilters(f=>({...f,locations:[]}))} />
              {[{id:'home',label:'🏠 Maison',color:'var(--green)'},{id:'ext',label:'📍 Externe',color:'var(--amber)'}].map(l => (
                <Chip key={l.id} active={locations.includes(l.id)} label={l.label} color={l.color}
                  onClick={()=>setFilters(f=>({...f,locations:f.locations.includes(l.id)?f.locations.filter(x=>x!==l.id):[...f.locations,l.id]}))} />
              ))}
            </div>
          </div>

          {/* Providers — multi */}
          {config?.providers?.length > 0 && (
            <LogoMultiSelect label="Fournisseur" options={config.providers} selected={providers} type="provider"
              onChange={v=>setFilters(f=>({...f,providers:v}))} />
          )}

          {/* Cards — multi */}
          {config?.cards?.length > 0 && (
            <LogoMultiSelect label="Carte utilisée" options={config.cards} selected={cards} type="card"
              onChange={v=>setFilters(f=>({...f,cards:v}))} color="var(--xpeng)" />
          )}

        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </>,
    document.body
  )
}

export function useFilters() {
  const [filters, setFilters] = React.useState({
    period:'all', customFrom:'', customTo:'',
    vehicles:[], providers:[], cards:[], locations:[]
  })
  const [showFilters, setShowFilters] = React.useState(false)

  function applyFilters(charges) {
    return charges.filter(c => {
      // Vehicles — multi
      if (filters.vehicles.length > 0 && !filters.vehicles.includes(c.vehicleId)) return false
      // Providers — multi
      if (filters.providers.length > 0 && !filters.providers.includes(c.provider)) return false
      // Cards — multi
      if (filters.cards.length > 0 && !filters.cards.includes(c.card)) return false
      // Locations — multi
      if (filters.locations.length > 0) {
        const loc = c.locationId === 'home' ? 'home' : 'ext'
        if (!filters.locations.includes(loc)) return false
      }
      // Period
      if (filters.period === 'custom') {
        if (filters.customFrom && c.date < filters.customFrom) return false
        if (filters.customTo   && c.date > filters.customTo)   return false
      } else if (filters.period !== 'all') {
        const now = new Date()
        let cutoff = new Date()
        if (filters.period==='month')  cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
        if (filters.period==='year')   cutoff = new Date(now.getFullYear(), 0, 1)
        if (filters.period==='30d')    cutoff.setDate(now.getDate()-30)
        if (filters.period==='12m')    cutoff.setMonth(now.getMonth()-12)
        if (c.date < cutoff.toISOString().slice(0,10)) return false
      }
      return true
    })
  }

  const activeCount = [
    filters.period !== 'all',
    filters.vehicles.length > 0,
    filters.providers.length > 0,
    filters.cards.length > 0,
    filters.locations.length > 0,
  ].filter(Boolean).length

  return { filters, setFilters, showFilters, setShowFilters, applyFilters, activeCount }
}
