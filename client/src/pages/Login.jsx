import React, { useState } from 'react'
import { apiLogin, apiRegister } from '../api.js'
import { VEHICLES } from '../utils.js'
import AppLogo from '../components/AppLogo.jsx'

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <AppLogo size={80} style={{ margin:'0 auto 16px', display:'block', boxShadow:'0 8px 32px rgba(79,142,247,0.3)' }} />
      <div style={{ fontSize:22, fontWeight:700 }}>EV Charge Tracker</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>Suivi de recharge</div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type='text' }) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoCapitalize="none"
      style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'13px 14px', fontSize:15, color:'var(--text)', outline:'none', transition:'border-color 0.15s', fontFamily:'inherit' }}
      onFocus={e=>e.target.style.borderColor='var(--accent)'}
      onBlur={e=>e.target.style.borderColor='var(--border)'}
    />
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      {children}
    </div>
  )
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [loginName, setLoginName] = useState('')
  const [loginPw,   setLoginPw]   = useState('')
  const [loginErr,  setLoginErr]  = useState('')
  const [loginLoad, setLoginLoad] = useState(false)
  const [regName,    setRegName]    = useState('')
  const [regPw,      setRegPw]      = useState('')
  const [regPw2,     setRegPw2]     = useState('')
  const [regVehicle, setRegVehicle] = useState('mg4')
  const [regErr,     setRegErr]     = useState('')
  const [regLoad,    setRegLoad]    = useState(false)

  async function handleLogin() {
    setLoginErr(''); setLoginLoad(true)
    try {
      const account = await apiLogin({ name: loginName.trim(), password: loginPw })
      onLogin(account)
    } catch(e) {
      setLoginErr(e.message)
    } finally { setLoginLoad(false) }
  }

  async function handleRegister() {
    setRegErr('')
    if (regPw.length < 4)    { setRegErr('Mot de passe trop court (4 car. min)'); return }
    if (regPw !== regPw2)    { setRegErr('Les mots de passe ne correspondent pas'); return }
    setRegLoad(true)
    try {
      const account = await apiRegister({ name: regName.trim(), password: regPw, vehicleId: regVehicle })
      onLogin(account)
    } catch(e) {
      setRegErr(e.message)
    } finally { setRegLoad(false) }
  }

  const tabStyle = (active) => ({
    flex:1, padding:'9px', borderRadius:8, border:'none',
    background: active ? 'var(--surface2)' : 'none',
    color: active ? 'var(--text)' : 'var(--muted)',
    fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
  })

  const btnStyle = (disabled) => ({
    width:'100%', padding:15,
    background: disabled ? 'var(--surface2)' : 'linear-gradient(135deg,var(--accent),var(--accent2))',
    color: disabled ? 'var(--muted)' : 'white',
    border:'none', borderRadius:'var(--r-sm)',
    fontSize:15, fontWeight:700, cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : '0 4px 20px var(--accent-glow)',
  })

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <Logo />
        <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:3, marginBottom:24 }}>
          <button onClick={() => setMode('login')}    style={tabStyle(mode==='login')}>Connexion</button>
          <button onClick={() => setMode('register')} style={tabStyle(mode==='register')}>Créer un compte</button>
        </div>

        {mode === 'login' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Nom"><TextInput value={loginName} onChange={setLoginName} placeholder="Ton nom" /></Field>
            <Field label="Mot de passe"><TextInput value={loginPw} onChange={setLoginPw} placeholder="••••••••" type="password" /></Field>
            {loginErr && <div style={{ fontSize:12, color:'var(--red)', textAlign:'center' }}>{loginErr}</div>}
            <button onClick={handleLogin} disabled={loginLoad||!loginName||!loginPw} style={btnStyle(loginLoad||!loginName||!loginPw)}>
              {loginLoad ? 'Connexion…' : 'Connexion'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Nom"><TextInput value={regName} onChange={setRegName} placeholder="Ex. Ludo" /></Field>
            <Field label="Mot de passe"><TextInput value={regPw} onChange={setRegPw} placeholder="••••••••" type="password" /></Field>
            <Field label="Confirmer le mot de passe"><TextInput value={regPw2} onChange={setRegPw2} placeholder="••••••••" type="password" /></Field>
            <Field label="Véhicule par défaut">
              <div style={{ display:'flex', gap:8 }}>
                {Object.values(VEHICLES).map(v => (
                  <button key={v.id} onClick={() => setRegVehicle(v.id)} style={{
                    flex:1, padding:'12px 8px', borderRadius:'var(--r-sm)',
                    border:`2px solid ${regVehicle===v.id ? v.color : 'var(--border)'}`,
                    background: regVehicle===v.id ? `rgba(${v.id==='mg4'?'79,142,247':'124,92,252'},0.08)` : 'var(--surface)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer',
                  }}>
                    <span style={{ fontSize:24 }}>{v.emoji}</span>
                    <span style={{ fontSize:12, fontWeight:600, color: regVehicle===v.id ? v.color : 'var(--text)' }}>{v.name}</span>
                  </button>
                ))}
              </div>
            </Field>
            {regErr && <div style={{ fontSize:12, color:'var(--red)', textAlign:'center' }}>{regErr}</div>}
            <button onClick={handleRegister} disabled={regLoad||!regName||!regPw||!regPw2} style={btnStyle(regLoad||!regName||!regPw||!regPw2)}>
              {regLoad ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
