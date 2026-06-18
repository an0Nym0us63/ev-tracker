import React, { useState, useEffect, useCallback } from 'react'
import './styles/globals.css'
import { useTheme } from './useTheme.js'
import AppLogo from './components/AppLogo.jsx'
import { usePullToRefresh } from './usePullToRefresh.js'
import { getToken, clearToken, apiMe, apiGetCharges, apiAddCharge, apiUpdateCharge, apiDeleteCharge, apiGetLists, apiGetSettings } from './api.js'
import Login from './pages/Login.jsx'
import Logs from './pages/Logs.jsx'
import BottomNav from './components/BottomNav.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AddCharge from './pages/AddCharge.jsx'
import History from './pages/History.jsx'
import Stats from './pages/Stats.jsx'
import MapView from './pages/MapView.jsx'
import Live from './pages/Live.jsx'
import Settings from './pages/Settings.jsx'
import FilterSheet, { useFilters } from './components/FilterSheet.jsx'
import ProfileMenu from './components/ProfileMenu.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding:24, fontFamily:'monospace', fontSize:12, color:'#ef4444', background:'#0f172a', minHeight:'100vh', overflowY:'auto' }}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:12 }}>⚠️ Erreur JS</div>
        <div style={{ whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{this.state.error.toString()}</div>
        <div style={{ marginTop:12, opacity:0.6 }}>{this.state.error.stack}</div>
        <button onClick={()=>this.setState({error:null})} style={{ marginTop:16, padding:'8px 16px', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:8, cursor:'pointer' }}>Réessayer</button>
      </div>
    )
    return this.props.children
  }
}

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
  const [alertFilter, setAlertFilter] = useState(null)
  const [editCharge, setEditCharge] = useState(null)
  const [toast,      setToast]      = useState(null)
  const { filters, setFilters, showFilters, setShowFilters, applyFilters, activeCount } = useFilters()

  // Inject custom vehicle colors (shared, set in Réglages) as CSS variable overrides.
  // Falls back to the theme's default colors when not customized.
  useEffect(() => {
    const mg4 = settings?.mg4Color
    const xpeng = settings?.xpengColor
    if (!mg4 && !xpeng) {
      document.documentElement.style.removeProperty('--mg4')
      document.documentElement.style.removeProperty('--xpeng')
      return
    }
    if (mg4)   document.documentElement.style.setProperty('--mg4', mg4)
    if (xpeng) document.documentElement.style.setProperty('--xpeng', xpeng)
  }, [settings?.mg4Color, settings?.xpengColor])

  const providerOptions = React.useMemo(() => [...new Set(charges.filter(c=>c.provider).map(c=>c.provider))].sort((a,b)=>a.localeCompare(b,'fr')), [charges])
  const cardOptions = React.useMemo(() => [...new Set(charges.filter(c=>c.card).map(c=>c.card))].sort((a,b)=>a.localeCompare(b,'fr')), [charges])

  const reload = useCallback(async () => {
    try {
      const [ch, li, st] = await Promise.all([apiGetCharges(), apiGetLists(), apiGetSettings()])
      setCharges(ch); setLists(li); setSettings(st)
    } catch(e) { console.error('reload error', e) }
  }, [])

  const { pulling, progress, refreshing } = usePullToRefresh(reload)

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

  function navigateWithAlert(filter) {
    setAlertFilter(filter)
    setPage('history')
  }

  const navigate = useCallback((target, data=null) => {
    window.scrollTo({ top:0, behavior:'instant' })
    if (target === 'edit') { setEditCharge(data); setPage('add') }
    else { setEditCharge(null); setPage(target) }
  }, [])

  async function handleSave(data) {
    try {
      if (data.__delete) {
        await apiDeleteCharge(data.id)
        setCharges(prev => prev.filter(c => c.id !== data.id))
        setEditCharge(null)
        showToast('Session supprimée', 'var(--red)')
        window.scrollTo({ top:0, behavior:'instant' })
        setPage('history')
      } else if (data.id) {
        const updated = await apiUpdateCharge(data.id, data)
        setCharges(prev => prev.map(c => c.id === updated.id ? updated : c))
        apiGetLists().then(setLists)
        setEditCharge(null)
        window.scrollTo({ top:0, behavior:'instant' })
        setPage('history')
        setTimeout(() => showToast('Session mise à jour ✓'), 100)
      } else {
        const created = await apiAddCharge(data)
        setCharges(prev => [created, ...prev])
        apiGetLists().then(setLists)
        setEditCharge(null)
        window.scrollTo({ top:0, behavior:'instant' })
        setPage('home')
        setTimeout(() => showToast('Session enregistrée ✓'), 100)
      }
    } catch(e) {
      console.error('[handleSave]', e)
      showToast(e.message||'Erreur lors de la sauvegarde', 'var(--red)')
      // Navigate away from add page even on error to avoid blank screen
      setEditCharge(null)
      window.scrollTo({ top:0, behavior:'instant' })
      setPage('home')
    }
  }

  if (loading)  return <Loader />
  if (!account) return <Login onLogin={handleLogin} />

  const isAddPage = page === 'add'

  const pullOffset = refreshing ? 54 : Math.round(progress * 54)

  return (
    <ErrorBoundary>
    <>
      {(pulling || refreshing) && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:150,
          display:'flex', justifyContent:'center', alignItems:'flex-end',
          height: pullOffset,
          overflow:'hidden', pointerEvents:'none',
          transition: pulling ? 'none' : 'height 0.2s ease',
        }}>
          <div style={{
            marginBottom:10, width:26, height:26, borderRadius:'50%',
            border:'2.5px solid var(--border)', borderTopColor:'var(--accent)',
            opacity: refreshing ? 1 : progress,
            transform: refreshing ? 'none' : `rotate(${progress*360}deg)`,
            animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
          }} />
        </div>
      )}
      <div style={{
        flex:1, minHeight:0, display:'flex', flexDirection:'column',
        transform: `translateY(${pullOffset}px)`,
        transition: pulling ? 'none' : 'transform 0.2s ease',
        willChange:'transform',
      }}>
        {page === 'home'     && <Dashboard charges={charges} account={account} onNavigate={navigate} onNavigateAlert={navigateWithAlert} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} filters={filters} applyFilters={applyFilters} />}
        {page === 'history'  && <History   charges={charges} onEdit={c=>navigate('edit',c)} alertFilter={alertFilter} onClearAlertFilter={()=>setAlertFilter(null)} filters={filters} applyFilters={applyFilters} account={account} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} onNavigate={navigate} />}
        {page === 'add'      && <AddCharge account={account} lists={lists} settings={settings} onSave={handleSave} editCharge={editCharge} onBack={()=>{ setPage(editCharge?'history':'home'); setEditCharge(null) }} />}
        {page === 'stats'    && <Stats     charges={charges} filters={filters} applyFilters={applyFilters} account={account} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} onNavigate={navigate} />}
        {page === 'map'      && <MapView   charges={charges} settings={settings} theme={theme} filters={filters} applyFilters={applyFilters} account={account} onLogout={handleLogout} onToggleTheme={toggleTheme} onNavigate={navigate} />}
        {page === 'live'     && <Live account={account} settings={settings} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} onNavigate={navigate} />}
        {page === 'logs'     && <Logs onBack={()=>navigate('home')} />}
        {page === 'settings' && <Settings  account={account} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} onSettingsSaved={setSettings} onAccountUpdate={setAccount} onBack={()=>setPage('home')} />}
      </div>

      {!isAddPage && <BottomNav active={page} onNavigate={navigate} onOpenFilters={()=>setShowFilters(true)} filterCount={activeCount} />}
      {toast && <Toast {...toast} />}
      {showFilters && (
        <FilterSheet
          onClose={()=>setShowFilters(false)}
          filters={filters} setFilters={setFilters}
          config={{ providers: providerOptions, cards: cardOptions }}
        />
      )}
    </>
    </ErrorBoundary>
  )
}
