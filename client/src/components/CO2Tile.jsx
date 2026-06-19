import React, { useState, useEffect, useRef } from 'react'

function fmt(n) {
  // Nombre entier avec séparateur de milliers — pas d'abréviation
  return Math.round(n).toLocaleString('fr-FR')
}

function getEquivalents(kg) {
  return [
    { icon:'🌳', val: fmt(kg/22),       unit:'arbres',              detail:'absorbant ce CO₂ en 1 an' },
    { icon:'🚗', val: fmt(kg/0.12),     unit:'km en voiture',       detail:'non parcourus en thermique' },
    { icon:'✈️', val: fmt(kg/1000),     unit:'vols',                detail:'Paris → New York évités' },
    { icon:'🍔', val: fmt(kg/2.5),      unit:'hamburgers',          detail:'en émissions évitées' },
    { icon:'🛁', val: fmt(kg/0.5),      unit:'bains chauds',        detail:'en émissions évitées' },
    { icon:'☕', val: fmt(kg/0.06),     unit:'expressos',           detail:'en empreinte carbone' },
    { icon:'🧀', val: fmt(kg/13.5),     unit:'kg de fromage',       detail:'en empreinte carbone' },
    { icon:'🚄', val: fmt(kg/0.006),    unit:'km en TGV',           detail:'avec cette empreinte carbone' },
    { icon:'📱', val: fmt(kg/0.005),    unit:'charges téléphone',   detail:'économisées' },
    { icon:'🏠', val: fmt(kg/16),       unit:'jours de foyer',      detail:'de consommation moyenne française' },
    { icon:'🥩', val: fmt(kg/27),       unit:'kg de bœuf',          detail:'en empreinte carbone' },
    { icon:'🍷', val: fmt(kg/1.27),     unit:'bouteilles de vin',   detail:'en empreinte carbone' },
    { icon:'🌾', val: fmt(kg/3.5),      unit:'kg de riz',           detail:'en empreinte carbone' },
    { icon:'🥛', val: fmt(kg/3.2),      unit:'litres de lait',      detail:'en empreinte carbone' },
    { icon:'🚢', val: fmt(kg/0.19),     unit:'km en ferry',         detail:'parcourus avec ce CO₂' },
    { icon:'🔥', val: fmt(kg/2.86),     unit:'kg de charbon',       detail:'non brûlés' },
    { icon:'🛵', val: fmt(kg/0.09),     unit:'km en scooter',       detail:'non parcourus' },
    { icon:'🍕', val: fmt(kg/0.9),      unit:'pizzas',              detail:'en empreinte carbone' },
    { icon:'👕', val: fmt(kg/7),        unit:'t-shirts en coton',   detail:'en empreinte carbone' },
    { icon:'🧴', val: fmt(kg/0.083),    unit:'bouteilles plastique', detail:'en empreinte carbone' },
  ]
}

export default function CO2Tile({ kg }) {
  const equivs = getEquivalents(kg)
  const n = equivs.length
  // Commence toujours à un index aléatoire, mais reste dans le même ordre de rotation
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * n))
  const [fade, setFade] = useState(true)
  const timerRef = useRef(null)
  const touchStartX = useRef(null)

  const goTo = (i) => {
    setFade(false)
    setTimeout(() => { setIdx((i + n) % n); setFade(true) }, 180)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => goTo(idx + 1), 5000)
    return () => clearInterval(timerRef.current)
  }, [idx])

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) { clearInterval(timerRef.current); goTo(dx < 0 ? idx + 1 : idx - 1) }
    touchStartX.current = null
  }

  const eq = equivs[idx]
  return (
    <div style={{ padding:'12px 14px', background:'rgba(245,158,11,0.07)', borderRadius:'var(--r-sm)', border:'1px solid rgba(245,158,11,0.25)', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600 }}>🌿 CO₂ évité vs thermique</div>
        <div className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--amber)' }}>
          {kg >= 1000 ? `${(kg/1000).toFixed(2)} t` : `${kg.toFixed(1)} kg`}
        </div>
      </div>
      <div style={{ opacity: fade ? 1 : 0, transition:'opacity 0.18s ease', minHeight:44, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{eq.icon}</span>
        <div>
          <span className="mono" style={{ fontSize:15, fontWeight:700, color:'var(--amber)' }}>{eq.val} </span>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{eq.unit}</span>
          <div style={{ fontSize:10.5, color:'var(--muted)', marginTop:1 }}>{eq.detail}</div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
        {equivs.map((_, i) => (
          <div key={i} onClick={() => { clearInterval(timerRef.current); goTo(i) }}
            style={{ width: i === idx ? 14 : 5, height:5, borderRadius:3, background: i === idx ? 'var(--amber)' : 'var(--border)', transition:'all 0.3s', cursor:'pointer' }} />
        ))}
      </div>
    </div>
  )
}
