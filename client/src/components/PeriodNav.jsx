import React from 'react'
import { getPeriodWindow } from '../utils.js'

const NAVIGABLE = ['month', 'year', '30d', '7d']

export default function PeriodNav({ filters, setFilters }) {
  const { period, periodOffset = 0 } = filters
  if (!NAVIGABLE.includes(period)) return null

  const win = getPeriodWindow(period, periodOffset)
  if (!win) return null

  const isToday = periodOffset === 0
  const go = (dir) => setFilters(f => ({ ...f, periodOffset: (f.periodOffset || 0) + dir }))

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'10px 16px 0', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)' }}>
      <button onClick={() => go(-1)}
        style={{ width:32, height:32, borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text)' }}>
        ‹
      </button>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{win.label}</div>
        {!isToday && (
          <button onClick={() => setFilters(f => ({ ...f, periodOffset: 0 }))}
            style={{ fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0, marginTop:1 }}>
            Revenir à maintenant
          </button>
        )}
      </div>
      <button onClick={() => go(+1)} disabled={isToday && (period === 'month' || period === 'year')}
        style={{ width:32, height:32, borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border)', cursor: (isToday && (period === 'month' || period === 'year')) ? 'default' : 'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color: (isToday && (period === 'month' || period === 'year')) ? 'var(--muted)' : 'var(--text)', opacity: (isToday && (period === 'month' || period === 'year')) ? 0.4 : 1 }}>
        ›
      </button>
    </div>
  )
}
