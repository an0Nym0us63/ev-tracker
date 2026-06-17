import React from 'react'

const TABS = [
  { id:'home',    label:'Accueil',    icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>
    </svg>
  )},
  { id:'stats',   label:'Stats',      icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6"/>
    </svg>
  )},
  { id:'add', isFab: true },
  { id:'map',     label:'Carte',      icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 10l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7"/>
    </svg>
  )},
  { id:'history', label:'Historique', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M7 9h10M7 13h7"/>
    </svg>
  )},
  { id:'filter',  label:'Filtres',    icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M7 12h10M10 18h4"/>
    </svg>
  )},
]

export default function BottomNav({ active, onNavigate, onOpenFilters, filterCount=0 }) {
  return (
    <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:'var(--nav-h)', paddingBottom:'var(--safe-bottom)', background:'var(--nav-bg)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'stretch', zIndex:100 }}>
      {TABS.map(tab => {
        if (tab.isFab) return (
          <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
            <button onClick={()=>onNavigate('add')} style={{ width:54, height:54, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'3px solid var(--nav-bg)', display:'flex', alignItems:'center', justifyContent:'center', marginTop:-22, boxShadow:'0 4px 20px var(--accent-glow)', cursor:'pointer' }}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.92)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
              onTouchStart={e=>e.currentTarget.style.transform='scale(0.92)'}
              onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
        )
        if (tab.id === 'filter') return (
          <button key={tab.id} onClick={onOpenFilters} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', color:filterCount>0?'var(--accent)':'var(--muted)', fontSize:10, fontWeight:filterCount>0?600:400, cursor:'pointer', position:'relative', opacity:filterCount>0?1:0.7 }}>
            <div style={{ position:'relative' }}>
              {tab.icon(filterCount>0)}
              {filterCount > 0 && (
                <div style={{ position:'absolute', top:-4, right:-7, minWidth:14, height:14, borderRadius:7, background:'var(--accent)', color:'white', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{filterCount}</div>
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        )
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={()=>onNavigate(tab.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', color:isActive?'var(--accent)':'var(--muted)', fontSize:10, fontWeight:isActive?600:400, cursor:'pointer', transition:'color 0.15s', paddingBottom:2, opacity:isActive?1:0.7 }}>
            {tab.icon(isActive)}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
