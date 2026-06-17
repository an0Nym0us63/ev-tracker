import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Converts a hex color to {h, s, l} for the sliders
function hexToHsl(hex) {
  if (!hex) return { h: 217, s: 91, l: 64 }
  const m = hex.replace('#','')
  const r = parseInt(m.substring(0,2),16)/255
  const g = parseInt(m.substring(2,4),16)/255
  const b = parseInt(m.substring(4,6),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h, s, l = (max+min)/2
  if (max === min) { h = 0; s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0)); break
      case g: h = (b-r)/d + 2; break
      default: h = (r-g)/d + 4
    }
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100) }
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h/30) % 12
  const a = s * Math.min(l, 1-l)
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)))
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

export default function ColorPicker({ value, onChange, defaultColor, size = 30 }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const current = value || defaultColor || '#4f8ef7'
  const [h, setH] = useState(0)
  const [s, setS] = useState(0)
  const [l, setL] = useState(0)

  useEffect(() => {
    if (!open) return
    const next = hexToHsl(current)
    setH(next.h); setS(next.s); setL(next.l)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (btnRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler, true)
    document.addEventListener('touchstart', handler, true)
    return () => {
      document.removeEventListener('mousedown', handler, true)
      document.removeEventListener('touchstart', handler, true)
    }
  }, [open])

  function openPicker() {
    const rect = btnRef.current.getBoundingClientRect()
    const popWidth = 240
    let left = rect.left
    if (left + popWidth > window.innerWidth - 12) left = window.innerWidth - popWidth - 12
    if (left < 12) left = 12
    let top = rect.bottom + 8
    if (top + 260 > window.innerHeight - 12) top = rect.top - 268
    setPos({ top, left })
    setOpen(true)
  }

  function apply(nh, ns, nl) {
    onChange(hslToHex(nh, ns, nl))
  }

  return (
    <>
      <button ref={btnRef} onClick={openPicker} aria-label="Choisir une couleur" style={{
        width: size, height: size, borderRadius: '50%', background: current, cursor: 'pointer',
        border: '2.5px solid var(--border)', flexShrink: 0, padding: 0,
        boxShadow: open ? '0 0 0 3px rgba(79,142,247,0.3)' : 'none',
      }} />

      {open && createPortal(
        <div ref={popRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: 240, zIndex: 9999,
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
          padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', animation: 'fadeUp 0.15s ease',
        }}>
          {/* Preview + hex */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background: hslToHex(h,s,l), border:'2px solid var(--border)', flexShrink:0 }} />
            <div className="mono" style={{ fontSize:13, fontWeight:600, color:'var(--text)', textTransform:'uppercase' }}>{hslToHex(h,s,l)}</div>
          </div>

          {/* Hue slider */}
          <div style={{ marginBottom:12 }}>
            <input type="range" min="0" max="360" value={h}
              onChange={e => { const nh = +e.target.value; setH(nh); apply(nh, s, l) }}
              className="cp-slider"
              style={{
                width: '100%', height: 14, borderRadius: 7, outline: 'none', cursor: 'pointer',
                background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                WebkitAppearance: 'none', appearance: 'none',
              }}
            />
          </div>

          {/* Saturation slider */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Saturation</div>
            <input type="range" min="0" max="100" value={s}
              onChange={e => { const ns = +e.target.value; setS(ns); apply(h, ns, l) }}
              className="cp-slider"
              style={{
                width: '100%', height: 14, borderRadius: 7, outline: 'none', cursor: 'pointer',
                background: `linear-gradient(to right, ${hslToHex(h,0,l)}, ${hslToHex(h,100,l)})`,
                WebkitAppearance: 'none', appearance: 'none',
              }}
            />
          </div>

          {/* Lightness slider */}
          <div>
            <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Luminosité</div>
            <input type="range" min="10" max="90" value={l}
              onChange={e => { const nl = +e.target.value; setL(nl); apply(h, s, nl) }}
              className="cp-slider"
              style={{
                width: '100%', height: 14, borderRadius: 7, outline: 'none', cursor: 'pointer',
                background: `linear-gradient(to right, ${hslToHex(h,s,10)}, ${hslToHex(h,s,50)}, ${hslToHex(h,s,90)})`,
                WebkitAppearance: 'none', appearance: 'none',
              }}
            />
          </div>

          <style>{`
            .cp-slider::-webkit-slider-thumb {
              -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
              background: white; border: 2px solid rgba(0,0,0,0.2); box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer;
            }
            .cp-slider::-moz-range-thumb {
              width: 18px; height: 18px; border-radius: 50%;
              background: white; border: 2px solid rgba(0,0,0,0.2); box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer;
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  )
}
