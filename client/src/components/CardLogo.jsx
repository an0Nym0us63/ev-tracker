import React, { useState } from 'react'
import { toLogoName } from './OperatorLogo.jsx'

// Displays a small card-brand visual (e.g. Atlante, Electra, Electroverse).
// Unlike OperatorLogo, there's no emoji fallback — if no card image exists,
// renders nothing so the layout doesn't show a meaningless placeholder.
export default function CardLogo({ name = '', size = 20, style = {} }) {
  const [failed, setFailed] = useState(false)

  if (!name.trim() || failed) return null

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
