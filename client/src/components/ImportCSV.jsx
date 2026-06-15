import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiImportCharges } from '../api.js'
import { VEHICLES } from '../utils.js'

// Expected CSV columns (case-insensitive, trimmed):
// date, vehicleId, locationId, provider, card, kwh, totalCost, durationMin
// locationName is optional (derived from locationId if absent)

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) throw new Error('CSV vide ou sans données')
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map((line, idx) => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    row._line = idx + 2
    return row
  })
}

function PreviewTable({ rows }) {
  const cols = ['date','vehicleId','locationId','provider','card','kwh','totalCost','durationMin']
  return (
    <div style={{ overflowX:'auto', maxHeight:280, border:'1px solid var(--border)', borderRadius:'var(--r-sm)' }}>
      <table style={{ borderCollapse:'collapse', fontSize:11, width:'100%', fontFamily:"'JetBrains Mono',monospace" }}>
        <thead>
          <tr style={{ background:'var(--surface2)', position:'sticky', top:0 }}>
            {cols.map(c => <th key={c} style={{ padding:'6px 10px', textAlign:'left', color:'var(--muted)', fontWeight:600, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,10).map((r, i) => (
            <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
              {cols.map(c => (
                <td key={c} style={{ padding:'5px 10px', color: r[c] ? 'var(--text)' : 'var(--red)', whiteSpace:'nowrap' }}>
                  {r[c] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <div style={{ padding:'6px 12px', fontSize:11, color:'var(--muted)', borderTop:'1px solid var(--border)' }}>
          … et {rows.length - 10} autres lignes
        </div>
      )}
    </div>
  )
}

export default function ImportCSV({ onDone }) {
  const [step, setStep]       = useState('idle') // idle | preview | importing | done | error
  const [rows, setRows]       = useState([])
  const [parseError, setParseError] = useState(null)
  const [result, setResult]   = useState(null)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result)
        setRows(parsed)
        setParseError(null)
        setStep('preview')
      } catch(err) {
        setParseError(err.message)
        setStep('error')
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  async function handleImport() {
    setStep('importing')
    try {
      const res = await apiImportCharges(rows)
      setResult(res)
      setStep('done')
      if (res.imported > 0) onDone?.()
    } catch(e) {
      setParseError(e.message)
      setStep('error')
    }
  }

  function reset() { setStep('idle'); setRows([]); setParseError(null); setResult(null) }

  // Sheet modal
  const sheet = step !== 'idle' && createPortal(
    <>
      <div onClick={reset} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:400 }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderRadius:'20px 20px 0 0', zIndex:401, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.4)', animation:'slideUp 0.2s ease' }}>
        <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>
            {step === 'preview'   && `Prévisualisation — ${rows.length} lignes`}
            {step === 'importing' && 'Import en cours…'}
            {step === 'done'      && 'Import terminé'}
            {step === 'error'     && 'Erreur'}
          </div>
          <button onClick={reset} style={{ width:32, height:32, borderRadius:'50%', background:'var(--surface2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16 }}>×</button>
        </div>

        <div style={{ overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
          {step === 'preview' && (
            <>
              <div style={{ fontSize:12, color:'var(--muted)' }}>
                Vérifie les données avant import. Les {Math.min(10, rows.length)} premières lignes sont affichées.
              </div>
              <PreviewTable rows={rows} />
              <button onClick={handleImport} style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', color:'white', fontSize:14, fontWeight:700, borderRadius:'var(--r-sm)', padding:'14px 20px', border:'none', cursor:'pointer' }}>
                ⚡ Importer {rows.length} session{rows.length > 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'importing' && (
            <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:14 }}>
              Import en cours…
            </div>
          )}

          {step === 'done' && result && (
            <>
              <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:'var(--r-sm)', padding:16, display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:28 }}>✅</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{result.imported} session{result.imported > 1 ? 's' : ''} importée{result.imported > 1 ? 's' : ''}</div>
                  {result.errors.length > 0 && <div style={{ fontSize:12, color:'var(--red)', marginTop:4 }}>{result.errors.length} ligne{result.errors.length > 1 ? 's' : ''} ignorée{result.errors.length > 1 ? 's' : ''}</div>}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div style={{ fontSize:11, color:'var(--muted)', background:'var(--surface2)', borderRadius:'var(--r-sm)', padding:12 }}>
                  {result.errors.slice(0,5).map((e,i) => <div key={i}>Ligne {e.row._line} : {e.error}</div>)}
                </div>
              )}
              <button onClick={reset} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:14, fontWeight:600, borderRadius:'var(--r-sm)', padding:'12px 20px', cursor:'pointer' }}>Fermer</button>
            </>
          )}

          {step === 'error' && (
            <>
              <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'var(--r-sm)', padding:16, color:'var(--red)', fontSize:13 }}>
                {parseError || 'Erreur inconnue'}
              </div>
              <button onClick={reset} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:14, fontWeight:600, borderRadius:'var(--r-sm)', padding:'12px 20px', cursor:'pointer' }}>Réessayer</button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }`}</style>
    </>,
    document.body
  )

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} />
      <button onClick={() => fileRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', cursor:'pointer', width:'100%', transition:'border-color 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
        onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
      >
        <span style={{ fontSize:20 }}>📥</span>
        <div style={{ flex:1, textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:600 }}>Importer un CSV</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>Format : date, vehicleId, locationId, provider, card, kwh, totalCost, durationMin</div>
        </div>
        <span style={{ color:'var(--muted)', fontSize:16 }}>›</span>
      </button>
      {sheet}
    </>
  )
}
