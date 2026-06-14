import React, { useState } from 'react'

// Map operator name keywords → domain for logo fetch
const OPERATOR_DOMAINS = {
  'ionity':         'ionity.eu',
  'totalenergies':  'totalenergies.com',
  'total energies': 'totalenergies.com',
  'total':          'totalenergies.com',
  'fastned':        'fastned.com',
  'tesla':          'tesla.com',
  'lidl':           'lidl.fr',
  'leclerc':        'e.leclerc',
  'engie':          'engie.fr',
  'freshmile':      'freshmile.com',
  'electra':        'go-electra.com',
  'bump':           'bump.sh',
  'izivia':         'izivia.com',
  'recharge':       'recharge.com',
  'beev':           'beev.co',
  'chargemap':      'chargemap.com',
  'borne to be':    'bornetobe.fr',
  'lumi':           'lumirail.com',
  'ekwateur':       'ekwateur.fr',
  'powerdot':       'powerdot.com',
  'a2c':            'a2c.fr',
  'driveco':        'driveco.com',
  'waat':           'waat.fr',
  'ev point':       'ev-point.eu',
  'station e':      'station-e.com',
}

const OPERATOR_EMOJIS = {
  'ionity': '🟡', 'totalenergies': '🔴', 'total': '🔴',
  'fastned': '🟠', 'tesla': '⚡', 'lidl': '🔵',
  'leclerc': '🔵', 'engie': '🟢', 'izivia': '🔵',
  'freshmile': '🟣', 'electra': '🟣', 'bump': '🟢',
  'beev': '🔵', 'recharge': '🔵', 'chargemap': '🔵',
}

function getDomain(name = '') {
  const lower = name.toLowerCase()
  const key = Object.keys(OPERATOR_DOMAINS).find(k => lower.includes(k))
  return key ? OPERATOR_DOMAINS[key] : null
}

function getEmoji(name = '') {
  const lower = name.toLowerCase()
  const key = Object.keys(OPERATOR_EMOJIS).find(k => lower.includes(k))
  return key ? OPERATOR_EMOJIS[key] : '🔌'
}

export default function OperatorLogo({ name = '', size = 20, style = {} }) {
  const [failed, setFailed] = useState(false)
  const domain = getDomain(name)

  if (!domain || failed) {
    return (
      <span style={{ fontSize: size * 0.9, lineHeight: 1, ...style }}>
        {getEmoji(name)}
      </span>
    )
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        objectFit: 'contain',
        background: 'white',
        padding: 1,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

// Export helper for non-React use
export { getDomain, getEmoji }
