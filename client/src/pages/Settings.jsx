import React, { useState, useEffect } from 'react'
import { VEHICLES } from '../utils.js'
import { apiGetSettings, apiSaveSettings, apiGeocode } from '../api.js'

function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>{hint}</div>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type='text' }) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'13px 14px', fontSize:15, color:'var(--text)', outline:'none', fontFamily:'inherit' }}
      onFocus={e=>e.target.style.borderColor='var(--accent)'}
      onBlur={e=>e.target.style.borderColor='var(--border)'}
    />
  )
}

export default function Settings({ account, onLogout }) {
  const vehicle = VEHICLES[account.vehicleId]
  const [ocmKey,     setOcmKey]     = useState('')
  const [homeLabel,  setHomeLabel]  = useState('')
  const [homeLat,    setHomeLat]    = useState(null)
  const [homeLng,    setHomeLng]    = useState(null)
  const [geocoding,  setGeocoding]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [geoResults, setGeoResults] = useState([])

  useEffect(() => {
    apiGetSettings().then(s => {
      setOcmKey(s.ocmApiKey || '')
      setHomeLabel(s.homeLabel || '')
      setHomeLat(s.homeLat || null)
      setHomeLng(s.homeLng || null)
    }).catch(() => {})
  }, [])

  async function searchHome() {
    if (!homeLabel.trim()) return
    setGeocoding(true)
    try {
      const results = await apiGeocode(homeLabel)
      setGeoResults(results.slice(0, 3))
    } catch {} finally { setGeocoding(false) }
  }

  function pickHome(r) {
    setHomeLat(r.lat); setHomeLng(r.lng)
    setHomeLabel(r.label.split(',')[0])
    setGeoResults([])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiSaveSettings({ ocmApiKey: ocmKey, homeLabel, homeLat, homeLng })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="page fade-up">
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>Réglages</div>
      </div>
      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:20 }}>

        <div>
          <div className="section-label">Mon compte</div>
          <div className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:18 }}>
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>{account.name}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:16 }}>{vehicle.emoji}</span>{vehicle.name} par défaut
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Domicile</div>
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Field label="Adresse / ville" hint="Affiché sur la carte pour les charges à domicile">
              <div style={{ display:'flex', gap:8 }}>
                <TextInput value={homeLabel} onChange={v=>{setHomeLabel(v);setGeoResults([])}} placeholder="Ex. Cellule, 03110" />
                <button onClick={searchHome} disabled={geocoding} style={{ padding:'0 14px', borderRadius:'var(--r-sm)', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                  {geocoding ? '…' : 'Localiser'}
                </button>
              </div>
            </Field>
            {geoResults.length > 0 && (
              <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r-sm)', overflow:'hidden' }}>
                {geoResults.map((r,i) => (
                  <div key={i} onClick={()=>pickHome(r)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:i<geoResults.length-1?'1px solid var(--border)':'none', fontSize:13 }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >📍 {r.label.split(',').slice(0,3).join(',')}</div>
                ))}
              </div>
            )}
            {homeLat && homeLng && (
              <div style={{ fontSize:11, color:'var(--green)' }}>✓ Localisé · {homeLat.toFixed(4)}, {homeLng.toFixed(4)}</div>
            )}
          </div>
        </div>

        <div>
          <div className="section-label">Open Charge Map</div>
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Field label="Clé API" hint="Gratuite sur openchargemap.org/develop — sans clé, fallback ville uniquement">
              <TextInput value={ocmKey} onChange={setOcmKey} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" type="password" />
            </Field>
            {!ocmKey
              ? <div style={{ fontSize:11, color:'var(--amber)' }}>⚠ Sans clé : recherche de bornes désactivée, fallback ville disponible</div>
              : <div style={{ fontSize:11, color:'var(--green)' }}>✓ Recherche Open Charge Map activée</div>
            }
          </div>
        </div>

        <div>
          <div className="section-label">Intégrations à venir</div>
          <div className="card" style={{ padding:0 }}>
            {[
              { icon:'🏠', name:'Home Assistant', detail:'Import automatique V2C Trydan' },
              { icon:'⛽', name:'Prix carburant',  detail:'SP95/Diesel France (data.gouv.fr)' },
            ].map((item,i,arr) => (
              <div key={item.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:i<arr.length-1?'1px solid var(--border)':'none', opacity:0.6 }}>
                <div style={{ fontSize:22, width:36, textAlign:'center' }}>{item.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{item.detail}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:'var(--amber)', background:'rgba(245,158,11,0.1)', padding:'3px 8px', borderRadius:20 }}>Bientôt</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ background:saved?'rgba(34,197,94,0.15)':'linear-gradient(135deg,var(--accent),var(--accent2))', border:saved?'1px solid var(--green)':'none', color:saved?'var(--green)':'white', fontSize:15, fontWeight:700, borderRadius:'var(--r-sm)', padding:15, cursor:'pointer', boxShadow:saved?'none':'0 4px 20px var(--accent-glow)' }}>
          {saved ? '✓ Enregistré' : saving ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>

        <button onClick={onLogout} style={{ background:'none', color:'var(--red)', fontSize:14, fontWeight:600, border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-sm)', padding:'14px 16px', cursor:'pointer' }}>
          Se déconnecter
        </button>

        <div style={{ textAlign:'center', fontSize:11, color:'var(--muted)', paddingBottom:8 }}>EV Charge Tracker v3.0</div>
      </div>
    </div>
  )
}
