import React from 'react'
import { createPortal } from 'react-dom'

function Chip({ active, label, onClick, color='var(--accent)' }) {
  return (
    <button onClick={onClick} style={{
      padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0,
      border:`1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? `${color}18` : 'var(--surface)',
      color: active ? color : 'var(--muted)',
      cursor:'pointer', whiteSpace:'nowrap',
    }}>{label}</button>
  )
}

export default function FilterSheet({ onClose, filters, setFilters, config }) {
  // config: { periods, vehicles, providers, cards, showLocation }
  const today = new Date().toISOString().slice(0,10)
  const { period, customFrom, customTo, vehicle, provider, card, location } = filters

  function reset() {
    setFilters({ period:'all', customFrom:'', customTo:'', vehicle:'all', provider:'all', card:'all', location:'all' })
  }

  const activeCount = [
    period !== 'all',
    vehicle !== 'all',
    provider !== 'all',
    card !== 'all',
    location !== 'all',
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
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderRadius:'20px 20px 0 0', zIndex:501, maxHeight:'82vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.4)', animation:'slideUp 0.2s ease' }}>

        <div style={{ padding:'14px 20px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>Filtres{activeCount > 0 ? ` (${activeCount})` : ''}</div>
          <div style={{ display:'flex', gap:8 }}>
            {activeCount > 0 && (
              <button onClick={reset} style={{ fontSize:11, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Réinitialiser</button>
            )}
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:'var(--surface2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16 }}>×</button>
          </div>
        </div>

        <div style={{ overflowY:'auto', padding:'14px 16px 32px', display:'flex', flexDirection:'column', gap:18 }}>

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

          {/* Vehicle */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Véhicule</div>
            <div style={{ display:'flex', gap:6 }}>
              <Chip active={vehicle==='all'}   label="Tous"      onClick={()=>setFilters(f=>({...f,vehicle:'all'}))} />
              <Chip active={vehicle==='mg4'}   label="MG4"       onClick={()=>setFilters(f=>({...f,vehicle:'mg4'}))}   color="var(--mg4)" />
              <Chip active={vehicle==='xpeng'} label="Xpeng G6"  onClick={()=>setFilters(f=>({...f,vehicle:'xpeng'}))} color="var(--xpeng)" />
            </div>
          </div>

          {/* Location */}
          {config?.showLocation && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Lieu</div>
              <div style={{ display:'flex', gap:6 }}>
                <Chip active={location==='all'}  label="Tous"     onClick={()=>setFilters(f=>({...f,location:'all'}))} />
                <Chip active={location==='home'} label="🏠 Maison"  onClick={()=>setFilters(f=>({...f,location:'home'}))} color="var(--green)" />
                <Chip active={location==='ext'}  label="📍 Externe" onClick={()=>setFilters(f=>({...f,location:'ext'}))}  color="var(--amber)" />
              </div>
            </div>
          )}

          {/* Provider */}
          {config?.providers?.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Fournisseur</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                <Chip active={provider==='all'} label="Tous" onClick={()=>setFilters(f=>({...f,provider:'all'}))} />
                {config.providers.map(p => <Chip key={p} active={provider===p} label={p} onClick={()=>setFilters(f=>({...f,provider:p}))} />)}
              </div>
            </div>
          )}

          {/* Card */}
          {config?.cards?.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Carte utilisée</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                <Chip active={card==='all'} label="Toutes" onClick={()=>setFilters(f=>({...f,card:'all'}))} />
                {config.cards.map(c => <Chip key={c} active={card===c} label={c} onClick={()=>setFilters(f=>({...f,card:c}))} />)}
              </div>
            </div>
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
    vehicle:'all', provider:'all', card:'all', location:'all'
  })
  const [showFilters, setShowFilters] = React.useState(false)

  function applyFilters(charges) {
    return charges.filter(c => {
      if (filters.vehicle !== 'all' && c.vehicleId !== filters.vehicle) return false
      if (filters.provider !== 'all' && c.provider !== filters.provider) return false
      if (filters.card !== 'all' && c.card !== filters.card) return false
      if (filters.location === 'home' && c.locationId !== 'home') return false
      if (filters.location === 'ext'  && c.locationId === 'home') return false
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
    filters.vehicle !== 'all',
    filters.provider !== 'all',
    filters.card !== 'all',
    filters.location !== 'all',
  ].filter(Boolean).length

  return { filters, setFilters, showFilters, setShowFilters, applyFilters, activeCount }
}
