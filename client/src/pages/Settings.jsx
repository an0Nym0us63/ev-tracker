import React, { useState, useEffect } from 'react'
import { VEHICLES } from '../utils.js'
import { apiGetSettings, apiSaveSettings, apiGeocode } from '../api.js'
import { VERSION } from '../version.js'
import ImportCSV from '../components/ImportCSV.jsx'
import { apiV2CSync, apiV2CSyncHistory } from '../api.js'
import AppLogo from '../components/AppLogo.jsx'

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

export default function Settings({ account, theme, onToggleTheme, onLogout, onSettingsSaved, onBack }) {
  const vehicle = VEHICLES[account.vehicleId]
  const [ocmKey,     setOcmKey]     = useState('')
  const [homeLabel,  setHomeLabel]  = useState('')
  const [homeLat,    setHomeLat]    = useState(null)
  const [homeLng,    setHomeLng]    = useState(null)
  const [geocoding,  setGeocoding]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [geoResults, setGeoResults] = useState([])
  const [debugInfo,  setDebugInfo]  = useState(null)

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
      setGeoResults(results)
    } catch {} finally { setGeocoding(false) }
  }

  function pickHome(r) {
    setHomeLat(r.lat); setHomeLng(r.lng)
    setHomeLabel([r.name, r.postcode].filter(Boolean).join(' '))
    setGeoResults([])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await apiSaveSettings({ ocmApiKey: ocmKey, homeLabel, homeLat, homeLng })
      onSettingsSaved?.(result)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  async function testOcm() {
    setDebugInfo('Test OCM en cours…')
    try {
      const res = await fetch('/api/ocm/search?lat=45.75&lng=4.85', {
        headers: { Authorization: `Bearer ${localStorage.getItem('ev-token')}` }
      })
      const data = await res.json()
      setDebugInfo(`${data.length} borne(s) autour de Lyon. ${data.length === 0 ? '⚠ Vérifie la clé.' : '✓ ' + data[0]?.name}`)
    } catch(e) { setDebugInfo(`❌ ${e.message}`) }
  }

  return (
    <div className="page fade-up" style={{ paddingBottom: 100 }}>
      {/* Header avec bouton retour */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px 0' }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', flexShrink:0 }}>←</button>
        <div style={{ fontSize:20, fontWeight:700, flex:1 }}>Réglages</div>
        {/* Theme toggle */}
        <button onClick={onToggleTheme} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, cursor:'pointer' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Compte */}
        <div>
          <div className="section-label">Mon compte</div>
          <div className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:18, color:'white' }}>
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

        {/* Apparence */}
        <div>
          <div className="section-label">Apparence</div>
          <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:600 }}>{theme === 'dark' ? 'Thème sombre' : 'Thème clair'}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>Changer l'apparence de l'app</div>
            </div>
            <button onClick={onToggleTheme} style={{
              padding:'8px 16px', borderRadius:20,
              background: theme === 'dark' ? 'rgba(79,142,247,0.1)' : 'rgba(109,40,217,0.1)',
              border: `1.5px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--xpeng)'}`,
              color: theme === 'dark' ? 'var(--accent)' : 'var(--xpeng)',
              fontSize:13, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6,
            }}>
              {theme === 'dark' ? '☀️ Passer au clair' : '🌙 Passer au sombre'}
            </button>
          </div>
        </div>

        {/* Domicile */}
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
                {geoResults.map((r,i) => {
                  const tags = [r.postcode, r.dept, !r.isFr && r.region, r.country].filter(Boolean)
                  return (
                    <div key={i} onClick={()=>pickHome(r)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:i<geoResults.length-1?'1px solid var(--border)':'none' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      <div style={{ fontSize:13, fontWeight:600 }}>{r.name}</div>
                      {tags.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                          {tags.map((t,j) => <span key={j} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>{t}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {homeLat && homeLng && (
              <div style={{ fontSize:11, color:'var(--green)' }}>✓ Localisé · {homeLat.toFixed(4)}, {homeLng.toFixed(4)}</div>
            )}
          </div>
        </div>

        {/* OCM */}
        <div>
          <div className="section-label">Open Charge Map</div>
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Field label="Clé API" hint="Gratuite sur openchargemap.org/develop">
              <TextInput value={ocmKey} onChange={setOcmKey} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" type="password" />
            </Field>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {!ocmKey
                ? <div style={{ fontSize:11, color:'var(--amber)', flex:1 }}>⚠ Sans clé : fallback ville uniquement</div>
                : <div style={{ fontSize:11, color:'var(--green)', flex:1 }}>✓ Clé renseignée</div>
              }
              {ocmKey && (
                <button onClick={testOcm} style={{ padding:'5px 12px', borderRadius:20, background:'var(--surface2)', border:'1px solid var(--border)', fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text)', flexShrink:0 }}>
                  Tester
                </button>
              )}
            </div>
            {debugInfo && (
              <div style={{ fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'8px 12px', color:'var(--text-secondary)', fontFamily:"'JetBrains Mono',monospace" }}>
                {debugInfo}
              </div>
            )}
          </div>
        </div>

        {/* Intégrations */}
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

        {/* V2C Cloud */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8 }}>V2C Cloud — Import auto</div>
          
          {/* Toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', marginBottom:8 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>Synchronisation automatique</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Importe les sessions de ta Trydan toutes les 10 min</div>
            </div>
            <button onClick={()=>setV2cEnabled(v=>!v)} style={{ width:44, height:26, borderRadius:13, background:v2cEnabled?'var(--accent)':'var(--surface2)', border:`2px solid ${v2cEnabled?'var(--accent)':'var(--border)'}`, cursor:'pointer', position:'relative', transition:'all 0.2s', flexShrink:0 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'white', position:'absolute', top:2, left:v2cEnabled?22:2, transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
            </button>
          </div>

          {v2cEnabled && (<>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Clé API V2C Cloud</div>
                <input value={v2cApiKey} onChange={e=>setV2cApiKey(e.target.value)} placeholder="Depuis v2c.cloud → API"
                  style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'10px 14px', fontSize:13, color:'var(--text)', fontFamily:"'JetBrains Mono',monospace", outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Device ID</div>
                <input value={v2cDeviceId} onChange={e=>setV2cDeviceId(e.target.value)} placeholder="Ex: GPPFMU"
                  style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'10px 14px', fontSize:13, color:'var(--text)', fontFamily:"'JetBrains Mono',monospace", outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button onClick={async()=>{
                setV2cSyncing(true); setV2cMsg(null)
                try {
                  const r = await apiV2CSync()
                  setV2cMsg({ type:'ok', text:`✓ ${r.created} créée(s), ${r.skipped} ignorée(s)` })
                } catch(e) { setV2cMsg({ type:'err', text:'Erreur: '+e.message }) }
                setV2cSyncing(false)
              }} disabled={v2cSyncing} style={{ flex:1, padding:'10px', borderRadius:'var(--r-sm)', background:'rgba(79,142,247,0.1)', border:'1.5px solid var(--accent)', color:'var(--accent)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                {v2cSyncing ? '…' : '🔄 Sync maintenant'}
              </button>
              <button onClick={async()=>{
                setV2cSyncing(true); setV2cMsg(null)
                try {
                  const r = await apiV2CSyncHistory()
                  setV2cMsg({ type:'ok', text:`✓ Historique: ${r.created} créée(s), ${r.skipped} ignorée(s)` })
                } catch(e) { setV2cMsg({ type:'err', text:'Erreur: '+e.message }) }
                setV2cSyncing(false)
              }} disabled={v2cSyncing} style={{ flex:1, padding:'10px', borderRadius:'var(--r-sm)', background:'var(--surface)', border:'1.5px solid var(--border)', color:'var(--muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                {v2cSyncing ? '…' : '📅 Sync 6 mois'}
              </button>
            </div>
            {v2cMsg && <div style={{ marginTop:8, padding:'8px 12px', borderRadius:'var(--r-sm)', background:v2cMsg.type==='ok'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', color:v2cMsg.type==='ok'?'var(--green)':'var(--red)', fontSize:12, fontWeight:600 }}>{v2cMsg.text}</div>}
          </>)}
        </div>

        {/* Import */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8 }}>Import</div>
          <ImportCSV onDone={() => window.location.reload()} />
        </div>

        <div style={{ textAlign:'center', paddingBottom:8, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <AppLogo size={48} style={{ opacity:0.7 }} />
          <div style={{ fontSize:11, color:'var(--muted)' }}>EV Charge Tracker {VERSION}</div>
        </div>
      </div>
    </div>
  )
}
