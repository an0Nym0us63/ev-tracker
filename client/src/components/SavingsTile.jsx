import React, { useState, useEffect, useRef } from 'react'

function fmt(n) {
  return Math.round(n).toLocaleString('fr-FR')
}

function getEquivalents(euros) {
  return [
    { icon:'🥩', val: fmt(euros/35),   unit:'côtes de bœuf',         detail:'au restaurant (à ~35 €)' },
    { icon:'🏨', val: fmt(euros/500),  unit:'nuits dans un palace',   detail:'chambre standard (à ~500 €)' },
    { icon:'🍕', val: fmt(euros/14),   unit:'pizzas livrées',         detail:'à domicile (à ~14 €)' },
    { icon:'🚗', val: fmt(euros/18000),unit:'voitures d\'occasion',   detail:'berline ~5 ans (à ~18 000 €)' },
    { icon:'🍾', val: fmt(euros/40),   unit:'bouteilles de champagne',detail:'grande surface (à ~40 €)' },
    { icon:'🎮', val: fmt(euros/70),   unit:'jeux vidéo',             detail:'jeu neuf console (à ~70 €)' },
    { icon:'✈️', val: fmt(euros/60),   unit:'vols Paris–Marseille',   detail:'low-cost (à ~60 €)' },
    { icon:'🍽️', val: fmt(euros/35),   unit:'repas au restaurant',    detail:'entrée-plat-dessert (à ~35 €)' },
    { icon:'⛽', val: fmt(euros/75),   unit:'pleins d\'essence',       detail:'réservoir 50 L (à ~75 €)' },
    { icon:'🏖️', val: fmt(euros/110),  unit:'nuits d\'hôtel',         detail:'chambre standard (à ~110 €)' },
    { icon:'🎟️', val: fmt(euros/55),   unit:'concerts',               detail:'placement moyen (à ~55 €)' },
    { icon:'👟', val: fmt(euros/110),  unit:'paires de Nike',         detail:'modèle courant (à ~110 €)' },
    { icon:'🍷', val: fmt(euros/18),   unit:'bouteilles de vin',      detail:'cave ou bistrot (à ~18 €)' },
    { icon:'🥂', val: fmt(euros/90),   unit:'dîners gastronomiques',  detail:'restaurant étoilé (à ~90 €)' },
    { icon:'📺', val: fmt(euros/17),   unit:'mois de Netflix',        detail:'abonnement mensuel (à ~17 €)' },
    { icon:'🎬', val: fmt(euros/13),   unit:'places de cinéma',       detail:'tarif normal (à ~13 €)' },
    { icon:'🧴', val: fmt(euros/80),   unit:'parfums',                detail:'flacon 50 mL (à ~80 €)' },
    { icon:'💈', val: fmt(euros/25),   unit:'coupes de cheveux',      detail:'salon classique (à ~25 €)' },
    { icon:'📚', val: fmt(euros/12),   unit:'livres',                 detail:'roman neuf (à ~12 €)' },
    { icon:'🎭', val: fmt(euros/45),   unit:'places d\'opéra',        detail:'placement milieu (à ~45 €)' },
  ]
}

export default function SavingsTile({ euros }) {
  const equivs = getEquivalents(euros)
  const n = equivs.length
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
        <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600 }}>💰 Économies vs thermique</div>
        <div className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--amber)' }}>
          {Math.round(euros).toLocaleString('fr-FR')} €
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
