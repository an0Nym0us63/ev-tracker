import React, { useRef } from 'react'

// A palette of distinct, pleasant colors that work well on both themes.
const PRESETS = [
  '#4f8ef7', '#7c5cfc', '#22c55e', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#64748b',
]

export default function ColorPicker({ value, onChange, defaultColor }) {
  const customInputRef = useRef(null)
  const current = value || defaultColor

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
      {PRESETS.map(c => (
        <button key={c} onClick={()=>onChange(c)} aria-label={c} style={{
          width:26, height:26, borderRadius:'50%', background:c, cursor:'pointer',
          border: current?.toLowerCase()===c.toLowerCase() ? '2.5px solid var(--text)' : '2px solid transparent',
          boxShadow: current?.toLowerCase()===c.toLowerCase() ? '0 0 0 2px var(--surface)' : 'none',
          flexShrink:0, padding:0, transition:'transform 0.1s',
        }}
          onMouseDown={e=>e.currentTarget.style.transform='scale(0.88)'}
          onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
        />
      ))}

      {/* Custom color swatch — opens native picker, shown as a small "+" wheel */}
      <button onClick={()=>customInputRef.current?.click()} style={{
        width:26, height:26, borderRadius:'50%', cursor:'pointer', flexShrink:0, padding:0,
        background: !PRESETS.some(c=>c.toLowerCase()===current?.toLowerCase())
          ? current
          : 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)',
        border: !PRESETS.some(c=>c.toLowerCase()===current?.toLowerCase()) ? '2.5px solid var(--text)' : '2px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {PRESETS.some(c=>c.toLowerCase()===current?.toLowerCase()) && (
          <span style={{ fontSize:12, color:'white', textShadow:'0 0 2px rgba(0,0,0,0.6)', fontWeight:700 }}>+</span>
        )}
      </button>
      <input ref={customInputRef} type="color" value={current || '#4f8ef7'} onChange={e=>onChange(e.target.value)}
        style={{ width:0, height:0, opacity:0, position:'absolute', pointerEvents:'none' }} />
    </div>
  )
}
