import React, { useState } from 'react'

const OPERATOR_EMOJIS = {
  'ionity': '🟡', 'totalenergies': '🔴', 'total energies': '🔴', 'total': '🔴',
  'fastned': '🟠', 'tesla': '⚡', 'lidl': '🔵', 'leclerc': '🔵',
  'engie': '🟢', 'izivia': '🔵', 'freshmile': '🟣', 'electra': '🟣',
  'bump': '🟢', 'beev': '🔵', 'recharge': '🔵', 'chargemap': '🔵',
  'driveco': '🟢', 'powerdot': '🔵', 'waat': '🟣', 'ekwateur': '🟢',
  'v2c': '🏠', 'trydan': '🏠',
}

function getEmoji(name = '') {
  const lower = name.toLowerCase()
  const key = Object.keys(OPERATOR_EMOJIS).find(k => lower.includes(k))
  return key ? OPERATOR_EMOJIS[key] : '🔌'
}

// Normalize name to match server filename
function toLogoName(name = '') {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function OperatorLogo({ name = '', size = 20, style = {} }) {
  const [failed, setFailed] = useState(false)

  if (!name.trim() || failed) {
    return <span style={{ fontSize: size * 0.85, lineHeight: 1, flexShrink: 0, ...style }}>{getEmoji(name)}</span>
  }

  return (
    <img
      src={`/api/logos/${encodeURIComponent(toLogoName(name))}`}
      alt={name}
      onError={() => setFailed(true)}
      style={{
        width: size, height: size,
        borderRadius: size * 0.2,
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

export { getEmoji, toLogoName }
