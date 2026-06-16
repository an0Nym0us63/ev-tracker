import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function ProfileMenu({ account, onNavigate, onLogout, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const name = account?.name || ''
  const initial = name ? name[0].toUpperCase() : '?'
  const vehicle = account?.vehicleId === 'mg4' ? 'MG4' : account?.vehicleId === 'xpeng' ? 'Xpeng G6' : ''

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (btnRef.current?.contains(e.target)) return   // ignore clicks on the button itself
      if (menuRef.current?.contains(e.target)) return  // ignore clicks inside menu
      setOpen(false)
    }
    // Use capture to intercept before other handlers
    document.addEventListener('mousedown', handler, true)
    document.addEventListener('touchstart', handler, true)
    return () => {
      document.removeEventListener('mousedown', handler, true)
      document.removeEventListener('touchstart', handler, true)
    }
  }, [open])

  const items = [
    { icon:'⚙️', label:'Réglages',        action: () => { onNavigate('settings'); setOpen(false) } },
    { icon:'📋', label:'Journal',          action: () => { onNavigate('logs'); setOpen(false) } },
    { icon: theme==='dark'?'☀️':'🌙',     label: theme==='dark'?'Mode clair':'Mode sombre', action: () => { onToggleTheme(); setOpen(false) } },
    { icon:'🚪', label:'Se déconnecter',   action: () => { onLogout(); setOpen(false) }, danger: true },
  ]

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} style={{
        width:36, height:36, borderRadius:'50%',
        background:'linear-gradient(135deg,var(--accent),var(--accent2))',
        border: open ? '2.5px solid white' : '2.5px solid transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'white', fontSize:15, fontWeight:700, cursor:'pointer',
        boxShadow: open ? '0 0 0 3px rgba(79,142,247,0.35)' : 'none',
        transition:'all 0.15s', flexShrink:0,
      }}>
        {initial}
      </button>

      {open && createPortal(
        <div ref={menuRef} style={{
          position:'fixed', top:68, right:14,
          background:'var(--surface2)', border:'1px solid var(--border)',
          borderRadius:'var(--r)', padding:'8px', zIndex:9999,
          boxShadow:'0 8px 32px rgba(0,0,0,0.35)', minWidth:210,
          animation:'fadeUp 0.15s ease',
        }}>
          <div style={{ padding:'8px 12px 10px', borderBottom:'1px solid var(--border)', marginBottom:6 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{name}</div>
            {vehicle && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Véhicule par défaut : {vehicle}</div>}
          </div>
          {items.map(item => (
            <button key={item.label} onMouseDown={e => { e.stopPropagation(); item.action() }} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'11px 12px', borderRadius:'var(--r-sm)', border:'none',
              background:'none', color: item.danger ? 'var(--red)' : 'var(--text)',
              fontSize:13, fontWeight:500, cursor:'pointer', textAlign:'left',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
            >
              <span style={{ fontSize:16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
