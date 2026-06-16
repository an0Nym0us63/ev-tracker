import React, { useState, useEffect, useCallback } from 'react'
import { apiGetLogs, apiClearLogs } from '../api.js'

const LEVEL_COLORS = {
  info:  'var(--text)',
  warn:  'var(--amber)',
  error: 'var(--red)',
}
const LEVEL_BG = {
  info:  'transparent',
  warn:  'rgba(251,191,36,0.06)',
  error: 'rgba(239,68,68,0.06)',
}
const LEVEL_ICONS = { info: '·', warn: '⚠', error: '✕' }

export default function Logs({ onBack }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setLogs(await apiGetLogs(200)) } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleClear() {
    if (!confirm('Vider tous les logs ?')) return
    await apiClearLogs()
    setLogs([])
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  function formatDate(s) {
    const d = new Date(s + 'Z')
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) + ' ' +
           d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
  }

  return (
    <div className="page fade-up" style={{ paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:'16px 20px 0', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)', padding:0 }}>←</button>
        <div style={{ fontSize:20, fontWeight:700, flex:1 }}>Journal</div>
        <button onClick={load} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--muted)' }}>↻</button>
        <button onClick={handleClear} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--red)', fontWeight:600 }}>Vider</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, padding:'10px 16px 0', overflowX:'auto', scrollbarWidth:'none' }}>
        {['all','info','warn','error'].map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 13px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0, border:`1.5px solid ${filter===f?'var(--accent)':'var(--border)'}`, background:filter===f?'rgba(79,142,247,0.1)':'var(--surface)', color:filter===f?'var(--accent)':'var(--muted)', cursor:'pointer' }}>
            {f === 'all' ? 'Tout' : f === 'info' ? 'Info' : f === 'warn' ? '⚠ Avert.' : '✕ Erreur'}
          </button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)', alignSelf:'center', flexShrink:0 }}>{filtered.length} entrée{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Logs */}
      <div style={{ margin:'10px 16px 0', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
        {loading && <div style={{ padding:24, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Chargement…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
            Aucun log{filter !== 'all' ? ' pour ce filtre' : ''}
          </div>
        )}
        {!loading && filtered.map((log, i) => (
          <div key={log.id} style={{ padding:'8px 14px', borderBottom: i < filtered.length-1 ? '1px solid var(--border)' : 'none', background:LEVEL_BG[log.level]||'transparent', display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:11, fontWeight:700, color:LEVEL_COLORS[log.level]||'var(--text)', flexShrink:0, marginTop:1 }}>{LEVEL_ICONS[log.level]||'·'}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:LEVEL_COLORS[log.level]||'var(--text)', wordBreak:'break-word', fontFamily: log.message.includes('=') ? "'JetBrains Mono',monospace" : 'inherit' }}>
                {log.message}
              </div>
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', flexShrink:0, marginTop:1, fontFamily:"'JetBrains Mono',monospace" }}>
              {formatDate(log.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
