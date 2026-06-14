import React, { useState, useRef, useEffect } from 'react'

export default function ComboBox({ value, onChange, options = [], placeholder, label }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef()

  // Sync if parent changes value
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()) && o !== query)

  function select(val) {
    setQuery(val)
    onChange(val)
    setOpen(false)
  }

  function handleChange(e) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 'var(--r-sm)', padding: '0 14px',
        transition: 'border-color 0.15s',
      }}>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 15, color: 'var(--text)', padding: '13px 0',
            fontFamily: 'inherit',
          }}
        />
        {options.length > 0 && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', fontSize: 12 }}
          >
            {open ? '▲' : '▼'}
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          maxHeight: 180, overflowY: 'auto',
        }}>
          {filtered.map((opt, i) => (
            <div
              key={opt}
              onMouseDown={() => select(opt)}
              style={{
                padding: '11px 14px', fontSize: 14, cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
