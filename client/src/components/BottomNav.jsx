import React, { useState, useEffect, useRef } from 'react'

const MAIN_TABS = [
  { id:'home',    label:'Accueil',     icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      {active && <path d="M9 21V12h6v9" fill="currentColor" stroke="currentColor" strokeWidth="2"/>}
      {!active && <path d="M9 21V12h6v9"/>}
    </svg>
  )},
  { id:'stats',   label:'Stats',       icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6"/>
    </svg>
  )},
  { id:'add',     isFab: true },
  { id:'history', label:'Historique',  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M7 9h10M7 13h7"/>
    </svg>
  )},
  { id:'map',     label:'Carte',       icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 10l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7"/>
    </svg>
  )},
]

const MORE_ITEMS = [
  { id:'settings', label:'Réglages', icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )},
]

export default function BottomNav({ active, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  useEffect(() => {
    if (!moreOpen) return
    const handler = (e) => { if (!moreRef.current?.contains(e.target)) setMoreOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [moreOpen])

  const isMoreActive = MORE_ITEMS.some(i => i.id === active)

  return (
    <>
      {moreOpen && (
        <div ref={moreRef} style={{ position:'fixed', bottom:'calc(var(--nav-h) + 8px)', right:12, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'6px', zIndex:200, boxShadow:'0 -4px 32px rgba(0,0,0,0.25)', minWidth:160, animation:'fadeUp 0.15s ease' }}>
          {MORE_ITEMS.map(item => (
            <button key={item.id} onClick={() => { onNavigate(item.id); setMoreOpen(false) }} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:'var(--r-sm)', border:'none', background: active===item.id?'rgba(79,142,247,0.1)':'none', color: active===item.id?'var(--accent)':'var(--text)', fontSize:14, fontWeight:500, cursor:'pointer' }}>
              <span style={{ color:'var(--muted)' }}>{item.icon()}</span>{item.label}
            </button>
          ))}
        </div>
      )}

      <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:'var(--nav-h)', paddingBottom:'var(--safe-bottom)', background:'var(--nav-bg)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'stretch', zIndex:100 }}>
        {MAIN_TABS.map(tab => {
          if (tab.isFab) return (
            <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
              <button onClick={()=>onNavigate('add')} style={{ width:54, height:54, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'3px solid var(--nav-bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', marginTop:-22, boxShadow:'0 4px 20px var(--accent-glow)', cursor:'pointer', flexShrink:0 }}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.93)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                onTouchStart={e=>e.currentTarget.style.transform='scale(0.93)'}
                onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
          )
          const isActive = active === tab.id
          return (
            <button key={tab.id} onClick={()=>onNavigate(tab.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', color:isActive?'var(--accent)':'var(--muted)', fontSize:10, fontWeight:isActive?600:400, cursor:'pointer', transition:'color 0.15s', paddingBottom:2 }}>
              <div style={{ opacity: isActive ? 1 : 0.65 }}>{tab.icon(isActive)}</div>
              <span>{tab.label}</span>
            </button>
          )
        })}

        {/* More */}
        <button onClick={()=>setMoreOpen(o=>!o)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', color:isMoreActive||moreOpen?'var(--accent)':'var(--muted)', fontSize:10, fontWeight:isMoreActive||moreOpen?600:400, cursor:'pointer', paddingBottom:2 }}>
          <div style={{ opacity: isMoreActive||moreOpen ? 1 : 0.65 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <span>Plus</span>
        </button>
      </nav>
    </>
  )
}
