import React, { useState } from 'react'
import { toLogoName } from './OperatorLogo.jsx'

// Displays a small card-brand visual (e.g. Atlante, Electra, Electroverse).
// Falls back to a generic card emoji badge if no image exists for this name.
export default function CardLogo({ name = '', size = 20, style = {} }) {
  const [failed, setFailed] = useState(false)

  const fallback = (
    <div style={{
      width: size * (85.6/54), height: size, borderRadius: size * 0.18,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.65, flexShrink: 0, lineHeight: 1, ...style,
    }}>💳</div>
  )

  if (!name.trim()) return fallback
  if (failed) return fallback

  return (
    <img
      src={`/api/logos/cards/${encodeURIComponent(toLogoName(name))}`}
      alt={name}
      onError={() => setFailed(true)}
      style={{
        height: size,
        width: size * (85.6/54),
        borderRadius: size * 0.18,
        objectFit: 'cover',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
