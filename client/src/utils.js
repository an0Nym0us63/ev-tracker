export const VEHICLES = {
  mg4:   { id: 'mg4',   name: 'MG4',      color: 'var(--mg4)',   dimColor: 'var(--mg4-dim)',   emoji: '🚗' },
  xpeng: { id: 'xpeng', name: 'Xpeng G6', color: 'var(--xpeng)', dimColor: 'var(--xpeng-dim)', emoji: '🚙' },
}

export const LOCATIONS = {
  home: { id: 'home', label: 'Maison',  emoji: '🏠', badgeClass: 'badge-home' },
  ext:  { id: 'ext',  label: 'Externe', emoji: '📍', badgeClass: 'badge-ext'  },
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export function computeStats(charges, vehicleId = null) {
  const f = vehicleId ? charges.filter(c => c.vehicleId === vehicleId) : charges
  const totalKwh  = f.reduce((s, c) => s + c.kwh, 0)
  const totalCost = f.reduce((s, c) => s + c.totalCost, 0)
  const count     = f.length
  const avgPrice  = totalKwh > 0 ? totalCost / totalKwh : 0
  const homeKwh   = f.filter(c => c.locationId === 'home').reduce((s, c) => s + c.kwh, 0)
  const extKwh    = f.filter(c => c.locationId !== 'home').reduce((s, c) => s + c.kwh, 0)
  return { totalKwh, totalCost, count, avgPrice, homeKwh, extKwh }
}

// Retourne { from: Date, to: Date, label: string } pour une période + offset
export function getPeriodWindow(period, offset = 0) {
  const now = new Date()
  let from, to, label

  if (period === 'week') {
    const d = new Date(now)
    const day = d.getDay() || 7 // lundi = 1, dimanche = 7
    d.setDate(d.getDate() - day + 1 + offset * 7) // lundi de la semaine
    from = new Date(d); from.setHours(0,0,0,0)
    to   = new Date(d); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999)
    const opts = { day:'numeric', month:'short' }
    label = `${from.toLocaleDateString('fr-FR',opts)} – ${to.toLocaleDateString('fr-FR',opts)}`
  } else if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    from = new Date(d.getFullYear(), d.getMonth(), 1)
    to   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    label = d.toLocaleDateString('fr-FR', { month:'long', year:'numeric' })
    label = label.charAt(0).toUpperCase() + label.slice(1)
  } else if (period === 'year') {
    const y = now.getFullYear() + offset
    from = new Date(y, 0, 1)
    to   = new Date(y, 11, 31)
    label = String(y)
  } else if (period === '3m') {
    const d = new Date(now.getFullYear(), now.getMonth() + offset * 3, 1)
    from = new Date(d.getFullYear(), d.getMonth(), 1)
    to   = new Date(d.getFullYear(), d.getMonth() + 3, 0)
    label = `${from.toLocaleDateString('fr-FR',{month:'short',year:'numeric'})} – ${to.toLocaleDateString('fr-FR',{month:'short',year:'numeric'})}`
  } else if (period === '30d') {
    const shift = offset * 30
    from = new Date(now); from.setDate(now.getDate() - 30 + shift)
    to   = new Date(now); to.setDate(now.getDate() + shift)
    label = `${from.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${to.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`
  } else if (period === '7d') {
    const shift = offset * 7
    from = new Date(now); from.setDate(now.getDate() - 7 + shift)
    to   = new Date(now); to.setDate(now.getDate() + shift)
    label = `${from.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${to.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`
  } else {
    return null
  }
  return { from, to, label }
}

export function filterByPeriod(charges, period, offset = 0) {
  if (period === 'all') return charges
  const win = getPeriodWindow(period, offset)
  if (win) {
    const fromStr = win.from.toISOString().slice(0, 10)
    const toStr   = win.to.toISOString().slice(0, 10)
    return charges.filter(c => c.date >= fromStr && c.date <= toStr)
  }
  // Fallback pour les autres périodes (12m, 3m, custom)
  const now = new Date(), cutoff = new Date()
  if (period === '12m')   cutoff.setMonth(now.getMonth() - 12)
  if (period === '3m')    cutoff.setMonth(now.getMonth() - 3)
  return charges.filter(c => new Date(c.date) >= cutoff)
}

export function getChartData(charges, period) {
  const now = new Date()

  // By year (all time)
  if (!period || period === 'all') {
    if (!charges.length) return []
    const years = {}
    charges.forEach(c => {
      const y = c.date.slice(0,4)
      if (!years[y]) years[y] = { label:y, mg4:0, xpeng:0 }
      years[y][c.vehicleId] = (years[y][c.vehicleId]||0) + c.kwh
    })
    return Object.values(years).sort((a,b)=>a.label.localeCompare(b.label))
  }

  // By month (year or 12m)
  if (period === 'year' || period === '12m') {
    const months = period === '12m' ? 12 : now.getMonth() + 1
    const startYear = period === '12m' ? null : now.getFullYear()
    return Array.from({ length: months }, (_, i) => {
      let d
      if (period === '12m') {
        d = new Date(now.getFullYear(), now.getMonth() - (months-1-i), 1)
      } else {
        d = new Date(now.getFullYear(), i, 1)
      }
      const y = d.getFullYear(), m = d.getMonth()
      const mc = charges.filter(c => {
        const cd = new Date(c.date)
        return cd.getFullYear()===y && cd.getMonth()===m
      })
      return {
        label: d.toLocaleDateString('fr-FR',{month:'short', year: period==='12m'&&d.getFullYear()!==now.getFullYear()?'2-digit':undefined}),
        mg4:   mc.filter(c=>c.vehicleId==='mg4').reduce((s,c)=>s+c.kwh,0),
        xpeng: mc.filter(c=>c.vehicleId==='xpeng').reduce((s,c)=>s+c.kwh,0),
      }
    })
  }

  // By day (month or 30d)
  const days = period === '30d' ? 30 : new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
  const startDate = period === '30d'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate()-29)
    : new Date(now.getFullYear(), now.getMonth(), 1)

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    if (d > now) return null
    const dateStr = d.toISOString().slice(0,10)
    const dc = charges.filter(c => c.date === dateStr)
    const showLabel = days <= 31 && (i === 0 || i === days-1 || d.getDate() % 5 === 1)
    return {
      label: showLabel ? `${d.getDate()}/${d.getMonth()+1}` : '',
      date: dateStr,
      mg4:   dc.filter(c=>c.vehicleId==='mg4').reduce((s,c)=>s+c.kwh,0),
      xpeng: dc.filter(c=>c.vehicleId==='xpeng').reduce((s,c)=>s+c.kwh,0),
    }
  }).filter(Boolean)
}

export function getDailyData(charges, days = 30) {
  return getChartData(charges, '30d')
}

export function getProviderStats(charges) {
  const map = {}
  charges.filter(c=>c.locationId!=='home').forEach(c => {
    const name = c.provider || 'Inconnu'
    if (!map[name]) map[name] = { name, kwh:0, sessions:0, cost:0 }
    map[name].kwh      += c.kwh
    map[name].sessions += 1
    map[name].cost     += c.totalCost||0
  })
  return Object.values(map).sort((a,b)=>b.kwh-a.kwh)
}

export function getCardStats(charges) {
  const map = {}
  charges.filter(c => c.card).forEach(c => {
    const name = c.card
    if (!map[name]) map[name] = { name, kwh:0, sessions:0, cost:0 }
    map[name].kwh      += c.kwh
    map[name].sessions += 1
    map[name].cost     += c.totalCost||0
  })
  return Object.values(map).sort((a,b)=>b.kwh-a.kwh)
}

export function getWeeklyData(charges, weeks = 6) {
  const now = new Date()
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(now)
    start.setDate(now.getDate() - (weeks - 1 - i) * 7 - now.getDay())
    start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    const wc = charges.filter(c => { const d = new Date(c.date); return d >= start && d <= end })
    return {
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      mg4:   wc.filter(c => c.vehicleId === 'mg4').reduce((s, c) => s + c.kwh, 0),
      xpeng: wc.filter(c => c.vehicleId === 'xpeng').reduce((s, c) => s + c.kwh, 0),
    }
  })
}

export function getMonthlyData(charges, months = 6) {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const mc = charges.filter(c => {
      const cd = new Date(c.date)
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
    })
    return {
      label:     d.toLocaleDateString('fr-FR', { month: 'short' }),
      kwh:       mc.reduce((s, c) => s + c.kwh, 0),
      cost:      mc.reduce((s, c) => s + c.totalCost, 0),
      isCurrent: i === months - 1,
    }
  })
}

// ─── Monthly average per vehicle, over full history ───────────────────────────
export function getMonthlyAvgByVehicle(charges) {
  const result = {}
  Object.keys(VEHICLES).forEach(vid => {
    const vc = charges.filter(c => c.vehicleId === vid)
    if (!vc.length) { result[vid] = { kwh: 0, cost: 0, months: 0 }; return }
    const dates = vc.map(c => new Date(c.date))
    const minD = new Date(Math.min(...dates))
    const maxD = new Date(Math.max(...dates))
    const months = Math.max(1, (maxD.getFullYear()-minD.getFullYear())*12 + (maxD.getMonth()-minD.getMonth()) + 1)
    result[vid] = {
      kwh:   vc.reduce((s,c)=>s+(c.kwh||0),0) / months,
      cost:  vc.reduce((s,c)=>s+(c.totalCost||0),0) / months,
      months,
    }
  })
  return result
}

// ─── Distribution by day of week (Mon-Sun), session count + kWh, split by location & vehicle ──
export function getWeekdayDistribution(charges) {
  const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
  const buckets = days.map(d => ({ label: d, sessions: 0, kwh: 0, homeKwh: 0, extKwh: 0, mg4Kwh: 0, xpengKwh: 0 }))
  charges.forEach(c => {
    const d = new Date(c.date + 'T00:00:00')
    const jsDay = d.getDay() // 0=Sun..6=Sat
    const idx = jsDay === 0 ? 6 : jsDay - 1 // convert to Mon=0..Sun=6
    const b = buckets[idx]
    b.sessions += 1
    b.kwh += c.kwh || 0
    if (c.locationId === 'home') b.homeKwh += c.kwh || 0
    else b.extKwh += c.kwh || 0
    if (c.vehicleId === 'mg4') b.mg4Kwh += c.kwh || 0
    else if (c.vehicleId === 'xpeng') b.xpengKwh += c.kwh || 0
  })
  return buckets
}

// ─── Power distribution histogram (kW buckets), split by location & vehicle ────
export function getPowerHistogramSplit(charges) {
  const homeBuckets = [
    { label:'<2',   min:0, max:2,        count:0, mg4Count:0, xpengCount:0 },
    { label:'2-4',  min:2, max:4,        count:0, mg4Count:0, xpengCount:0 },
    { label:'4-6',  min:4, max:6,        count:0, mg4Count:0, xpengCount:0 },
    { label:'>6',   min:6, max:Infinity, count:0, mg4Count:0, xpengCount:0 },
  ]
  const extBuckets = [
    { label:'<100',     min:0,   max:100,      count:0, mg4Count:0, xpengCount:0 },
    { label:'100-150',  min:100, max:150,      count:0, mg4Count:0, xpengCount:0 },
    { label:'150-200',  min:150, max:200,      count:0, mg4Count:0, xpengCount:0 },
    { label:'>200',     min:200, max:Infinity, count:0, mg4Count:0, xpengCount:0 },
  ]
  charges.forEach(c => {
    if (!c.durationMin || c.durationMin <= 0) return
    const kw = c.kwh / (c.durationMin/60)
    const buckets = c.locationId === 'home' ? homeBuckets : extBuckets
    const b = buckets.find(b => kw >= b.min && kw < b.max)
    if (!b) return
    b.count += 1
    if (c.vehicleId === 'mg4') b.mg4Count += 1
    else if (c.vehicleId === 'xpeng') b.xpengCount += 1
  })
  return { home: homeBuckets.filter(b=>b.count>0), ext: extBuckets.filter(b=>b.count>0) }
}

// ─── Formatters ───────────────────────────────────────────────────────────────
export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
export function formatDuration(min) {
  if (!min) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}
export function formatCost(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
