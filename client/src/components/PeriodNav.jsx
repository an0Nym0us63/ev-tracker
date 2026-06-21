import React from 'react'
import { getPeriodWindow } from '../utils.js'

const NAVIGABLE = ['week', 'month', '3m', 'year', '30d', '7d']

export default function PeriodNav({ filters, setFilters }) {
  const { period, periodOffset = 0 } = filters
  if (!NAVIGABLE.includes(period)) return null

  const win = getPeriodWindow(period, periodOffset)
  if (!win) return null

  const isAtNow = periodOffset >= 0 && ['month','year','week','3m'].includes(period)
  const go = (dir) => setFilters(f => ({ ...f, periodOffset: (f.periodOffset || 0) + dir }))

  return (
    <div style={{ position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 0 0', padding:'8px 16px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
      <button onClick={() => go(-1)}
        style={{ width:32, height:32, borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text)' }}>
        ‹
      </button>
      <div style={{ textAlign:'center', flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{win.label}</div>
        {periodOffset !== 0 && (
          <button onClick={() => setFilters(f => ({ ...f, periodOffset: 0 }))}
            style={{ fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0, marginTop:1 }}>
            Revenir à maintenant
          </button>
        )}
      </div>
      <button onClick={() => go(+1)} disabled={isAtNow}
        style={{ width:32, height:32, borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)', cursor: isAtNow ? 'default' : 'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color: isAtNow ? 'var(--muted)' : 'var(--text)', opacity: isAtNow ? 0.35 : 1 }}>
        ›
      </button>
    </div>
  )
}
