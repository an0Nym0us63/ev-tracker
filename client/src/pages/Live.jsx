import React from 'react'
import ProfileMenu from '../components/ProfileMenu.jsx'

export default function Live({ account, onLogout, theme, onToggleTheme, onNavigate }) {
  return (
    <div className="page fade-up" style={{ paddingBottom:100, minHeight:'100dvh', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Live</div>
        <ProfileMenu account={account} onNavigate={onNavigate} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, padding:'0 40px', textAlign:'center' }}>
        <div style={{ fontSize:44 }}>📡</div>
        <div style={{ fontSize:16, fontWeight:700 }}>Bientôt disponible</div>
        <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5 }}>
          Supervision en temps réel de la borne V2C et des véhicules via Home Assistant.
        </div>
      </div>
    </div>
  )
}
