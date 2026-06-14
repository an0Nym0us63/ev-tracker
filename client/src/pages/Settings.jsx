import React from 'react'
import { VEHICLES } from '../utils.js'

export default function Settings({ account, onLogout }) {
  const vehicle = VEHICLES[account.vehicleId]
  return (
    <div className="page fade-up">
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>Réglages</div>
      </div>

      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Compte */}
        <div>
          <div className="section-label">Mon compte</div>
          <div className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:18 }}>
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>{account.name}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:16 }}>{vehicle.emoji}</span>
                {vehicle.name} par défaut
              </div>
            </div>
          </div>
        </div>

        {/* Intégrations à venir */}
        <div>
          <div className="section-label">Intégrations</div>
          <div className="card" style={{ padding:0 }}>
            {[
              { icon:'🏠', name:'Home Assistant', detail:'Import automatique V2C Trydan', status:'Bientôt' },
              { icon:'⛽', name:'Prix carburant', detail:'SP95/Diesel France (data.gouv.fr)', status:'Bientôt' },
            ].map((item, i, arr) => (
              <div key={item.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom: i<arr.length-1?'1px solid var(--border)':'none', opacity:0.7 }}>
                <div style={{ fontSize:22, width:36, textAlign:'center' }}>{item.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{item.detail}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:'var(--amber)', background:'rgba(245,158,11,0.1)', padding:'3px 8px', borderRadius:20 }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Déconnexion */}
        <button onClick={onLogout} style={{
          background:'none', color:'var(--red)', fontSize:14, fontWeight:600,
          border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-sm)',
          padding:'14px 16px', cursor:'pointer', width:'100%',
        }}>
          Se déconnecter
        </button>

        <div style={{ textAlign:'center', fontSize:11, color:'var(--muted)', paddingBottom:8 }}>
          EV Charge Tracker v2.0
        </div>
      </div>
    </div>
  )
}
