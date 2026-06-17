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

// OCM renvoie souvent la raison sociale complète (ex: "Allego B.V.", "IONITY GmbH",
// "TotalEnergies SA") alors que les fichiers logos sont nommés d'après le nom usuel
// court. On normalise (suppression points/virgules) puis on resout via cet alias
// avant de retomber sur le slug brut.
const LOGO_ALIASES = {
  'allego bv':          'allego-bv',
  'allego':             'allego-bv',
  'totalenergies sa':   'totalenergies',
  'totalenergies sasu': 'totalenergies',
  'total energies':     'totalenergies',
  'total':              'totalenergies',
  'ionity gmbh':         'ionity',
  'fastned nv':          'fastned',
  'fastned bv':          'fastned',
  'bump fr':             'bump-fr',
  'v2c trydan':          'v2c-trydan',
}

function normalizeForAlias(name = '') {
  return name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

// Normalize name to match server filename
function toLogoName(name = '') {
  const alias = LOGO_ALIASES[normalizeForAlias(name)]
  if (alias) return alias
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function OperatorLogo({ name = '', size = 20, style = {} }) {
  const [failed, setFailed] = useState(false)

  if (!name.trim() || failed) {
    return <span style={{ fontSize: size * 0.85, lineHeight: 1, flexShrink: 0, ...style }}>{getEmoji(name)}</span>
  }

  return (
    <img
      src={`/api/logos/providers/${encodeURIComponent(toLogoName(name))}`}
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
