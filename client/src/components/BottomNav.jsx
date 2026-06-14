import React, { useState, useEffect, useRef } from 'react'

const MAIN_TABS = [
  { id:'home',    emoji:'📊', label:'Accueil' },
  { id:'history', emoji:'📋', label:'Historique' },
  { id:'add',     isFab: true },
  { id:'stats',   emoji:'📈', label:'Stats' },
  { id:'map',     emoji:'🗺️',  label:'Carte' },
]

const MORE_ITEMS = [
  { id:'settings', emoji:'⚙️', label:'Réglages' },
]

export default function BottomNav({ active, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  // Close on outside tap
  useEffect(() => {
    if (!moreOpen) return
    const handler = (e) => {
      if (!moreRef.current?.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [moreOpen])

  const isMoreActive = MORE_ITEMS.some(i => i.id === active)

  return (
    <>
      {/* More menu popup */}
      {moreOpen && (
        <div ref={moreRef} style={{
          position:'fixed', bottom:'calc(var(--nav-h) + 8px)', right:12,
          background:'var(--surface2)', border:'1px solid var(--border)',
          borderRadius:'var(--r)', padding:'6px', zIndex:200,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          minWidth:160,
          animation:'fadeUp 0.15s ease',
        }}>
          {MORE_ITEMS.map(item => (
            <button key={item.id} onClick={() => { onNavigate(item.id); setMoreOpen(false) }} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'10px 14px', borderRadius:'var(--r-sm)', border:'none',
              background: active === item.id ? 'rgba(79,142,247,0.1)' : 'none',
              color: active === item.id ? 'var(--accent)' : 'var(--text)',
              fontSize:14, fontWeight:500, cursor:'pointer',
              transition:'background 0.1s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
              onMouseLeave={e=>e.currentTarget.style.background=active===item.id?'rgba(79,142,247,0.1)':'transparent'}
            >
              <span style={{ fontSize:18 }}>{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}

      <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:'var(--nav-h)', paddingBottom:'var(--safe-bottom)', background:'rgba(26,29,39,0.96)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', zIndex:100 }}>
        {MAIN_TABS.map(tab => {
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

        {/* More button */}
        <button onClick={()=>setMoreOpen(o=>!o)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, paddingTop:8, background:'none', border:'none', color:isMoreActive||moreOpen?'var(--accent)':'var(--muted)', fontSize:10, fontWeight:isMoreActive||moreOpen?600:500, cursor:'pointer', transition:'color 0.15s' }}>
          <div style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, background:isMoreActive||moreOpen?'rgba(79,142,247,0.15)':'transparent' }}>
            {moreOpen ? '✕' : '···'}
          </div>
          <span>Plus</span>
        </button>
      </nav>
    </>
  )
}
