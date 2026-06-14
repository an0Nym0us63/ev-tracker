export const VEHICLES = {
  mg4:   { id: 'mg4',   name: 'MG4',      color: 'var(--mg4)',   dimColor: 'var(--mg4-dim)',   emoji: '🚗', thermalRef: 6.5 },
  xpeng: { id: 'xpeng', name: 'Xpeng G6', color: 'var(--xpeng)', dimColor: 'var(--xpeng-dim)', emoji: '🚙', thermalRef: 7.0 },
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

  const withOdo = f.filter(c => c.odometer != null).sort((a, b) => a.date.localeCompare(b.date))
  let consoKwh100 = null
  if (withOdo.length >= 2) {
    const first = withOdo[0], last = withOdo[withOdo.length - 1]
    const km  = last.odometer - first.odometer
    const kwh = f.filter(c => c.date >= first.date && c.date <= last.date).reduce((s, c) => s + c.kwh, 0)
    if (km > 0) consoKwh100 = (kwh / km) * 100
  }
  return { totalKwh, totalCost, count, avgPrice, homeKwh, extKwh, consoKwh100 }
}

export function filterByPeriod(charges, period) {
  if (period === 'all') return charges
  const now = new Date(), cutoff = new Date()
  if (period === '7d')    cutoff.setDate(now.getDate() - 7)
  if (period === 'month') cutoff.setDate(1)
  if (period === '3m')    cutoff.setMonth(now.getMonth() - 3)
  return charges.filter(c => new Date(c.date) >= cutoff)
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
