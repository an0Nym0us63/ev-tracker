import React, { useState, useEffect, useCallback } from 'react'
import './styles/globals.css'
import { useTheme } from './useTheme.js'
import AppLogo from './components/AppLogo.jsx'
import { getToken, clearToken, apiMe, apiGetCharges, apiAddCharge, apiUpdateCharge, apiDeleteCharge, apiGetLists, apiGetSettings } from './api.js'
import Login from './pages/Login.jsx'
import BottomNav from './components/BottomNav.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AddCharge from './pages/AddCharge.jsx'
import History from './pages/History.jsx'
import Stats from './pages/Stats.jsx'
import MapView from './pages/MapView.jsx'
import Settings from './pages/Settings.jsx'

function Toast({ msg, color }) {
  return (
    <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'var(--surface2)', border:`1px solid ${color}`, color, fontWeight:600, fontSize:13, padding:'10px 20px', borderRadius:24, boxShadow:'0 8px 32px rgba(0,0,0,0.4)', zIndex:200, whiteSpace:'nowrap', animation:'fadeUp 0.2s ease' }}>
      {msg}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <AppLogo size={72} style={{ boxShadow:'0 8px 32px rgba(79,142,247,0.3)' }} />
      <div style={{ fontSize:13, color:'var(--muted)' }}>Chargement…</div>
    </div>
  )
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [account,    setAccount]    = useState(null)
  const [charges,    setCharges]    = useState([])
  const [lists,      setLists]      = useState({ providers:[], cards:[] })
  const [settings,   setSettings]   = useState({})
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState('home')
  const [editCharge, setEditCharge] = useState(null)
  const [toast,      setToast]      = useState(null)

  useEffect(() => {
    async function init() {
      if (!getToken()) { setLoading(false); return }
      try {
        const [acc, ch, li, st] = await Promise.all([apiMe(), apiGetCharges(), apiGetLists(), apiGetSettings()])
        setAccount(acc); setCharges(ch); setLists(li); setSettings(st)
      } catch { clearToken() }
      finally { setLoading(false) }
    }
    init()
  }, [])

  function showToast(msg, color='var(--green)') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2400)
  }

  async function handleLogin(acc) {
    setAccount(acc)
    const [ch, li, st] = await Promise.all([apiGetCharges(), apiGetLists(), apiGetSettings()])
    setCharges(ch); setLists(li); setSettings(st)
    setPage('home')
  }

  function handleLogout() {
    clearToken(); setAccount(null); setCharges([]); setLists({ providers:[], cards:[] }); setSettings({})
    setPage('home')
  }

  const navigate = useCallback((target, data=null) => {
    if (target === 'edit') { setEditCharge(data); setPage('add') }
    else { setEditCharge(null); setPage(target) }
  }, [])

  async function handleSave(data) {
    try {
      if (data.__delete) {
        await apiDeleteCharge(data.id)
        setCharges(prev => prev.filter(c => c.id !== data.id))
        showToast('Session supprimée', 'var(--red)')
        setPage('history')
      } else if (data.id) {
        const updated = await apiUpdateCharge(data.id, data)
        setCharges(prev => prev.map(c => c.id === updated.id ? updated : c))
        apiGetLists().then(setLists)
        showToast('Session mise à jour ✓')
        setPage('history')
      } else {
        const created = await apiAddCharge(data)
        setCharges(prev => [created, ...prev])
        apiGetLists().then(setLists)
        showToast('Session enregistrée ✓')
        setPage('home')
      }
    } catch(e) { showToast(e.message||'Erreur', 'var(--red)') }
    setEditCharge(null)
  }

  if (loading)  return <Loader />
  if (!account) return <Login onLogin={handleLogin} />

  const isAddPage = page === 'add'

  return (
    <>
      {page === 'home'     && <Dashboard charges={charges} onNavigate={navigate} />}
      {page === 'history'  && <History   charges={charges} onEdit={c=>navigate('edit',c)} />}
      {page === 'add'      && <AddCharge account={account} lists={lists} onSave={handleSave} editCharge={editCharge} onBack={()=>{ setPage(editCharge?'history':'home'); setEditCharge(null) }} />}
      {page === 'stats'    && <Stats     charges={charges} />}
      {page === 'map'      && <MapView   charges={charges} settings={settings} theme={theme} />}
      {page === 'settings' && <Settings  account={account} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} onSettingsSaved={setSettings} onBack={()=>setPage('home')} />}

      {!isAddPage && <BottomNav active={page} onNavigate={navigate} />}
      {toast && <Toast {...toast} />}
    </>
  )
}
