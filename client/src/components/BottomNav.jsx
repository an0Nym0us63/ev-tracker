import React from 'react'

const TABS = [
  { id:'home',     emoji:'📊', label:'Accueil' },
  { id:'history',  emoji:'📋', label:'Historique' },
  { id:'add',      isFab: true },
  { id:'stats',    emoji:'📈', label:'Stats' },
  { id:'map',      emoji:'🗺️',  label:'Carte' },
]

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:'var(--nav-h)', paddingBottom:'var(--safe-bottom)', background:'rgba(26,29,39,0.96)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', zIndex:100 }}>
      {TABS.map(tab => {
        if (tab.isFab) return (
          <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
            <button onClick={()=>onNavigate('add')} style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'white', marginTop:-20, boxShadow:'0 4px 20px var(--accent-glow)', cursor:'pointer' }}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.93)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
              onTouchStart={e=>e.currentTarget.style.transform='scale(0.93)'}
              onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
            >＋</button>
          </div>
        )
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={()=>onNavigate(tab.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, paddingTop:8, background:'none', border:'none', color:isActive?'var(--accent)':'var(--muted)', fontSize:10, fontWeight:isActive?600:500, cursor:'pointer', transition:'color 0.15s' }}>
            <div style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, background:isActive?'rgba(79,142,247,0.15)':'transparent' }}>{tab.emoji}</div>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
