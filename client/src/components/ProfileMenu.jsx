import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function ProfileMenu({ account, onNavigate, onLogout, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const initial = (account?.name || '?')[0].toUpperCase()
  const vehicle = account?.vehicleId === 'mg4' ? 'MG4' : account?.vehicleId === 'xpeng' ? 'Xpeng G6' : ''

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [open])

  const menuItems = [
    { icon:'⚙️', label:'Réglages', action: () => { onNavigate('settings'); setOpen(false) } },
    { icon: theme==='dark'?'☀️':'🌙', label: theme==='dark'?'Mode clair':'Mode sombre', action: () => { onToggleTheme(); setOpen(false) } },
    { icon:'🚪', label:'Se déconnecter', action: () => { onLogout(); setOpen(false) }, danger: true },
  ]

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:36, height:36, borderRadius:'50%',
        background:`linear-gradient(135deg, var(--accent), var(--accent2))`,
        border: open ? '2px solid var(--accent)' : '2px solid transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'white', fontSize:15, fontWeight:700, cursor:'pointer',
        boxShadow: open ? '0 0 0 3px rgba(79,142,247,0.3)' : 'none',
        transition:'all 0.15s', flexShrink:0,
      }}>
        {initial}
      </button>

      {open && createPortal(
        <div style={{
          position:'fixed', top:70, right:16,
          background:'var(--surface2)', border:'1px solid var(--border)',
          borderRadius:'var(--r)', padding:'8px', zIndex:500,
          boxShadow:'0 8px 32px rgba(0,0,0,0.3)', minWidth:200,
          animation:'fadeUp 0.15s ease',
        }}>
          {/* Account info */}
          <div style={{ padding:'8px 12px 10px', borderBottom:'1px solid var(--border)', marginBottom:6 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{account?.name}</div>
            {vehicle && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Véhicule par défaut : {vehicle}</div>}
          </div>

          {menuItems.map(item => (
            <button key={item.label} onClick={item.action} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'10px 12px', borderRadius:'var(--r-sm)', border:'none',
              background:'none', color: item.danger ? 'var(--red)' : 'var(--text)',
              fontSize:13, fontWeight:500, cursor:'pointer', textAlign:'left',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
            >
              <span style={{ fontSize:16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
