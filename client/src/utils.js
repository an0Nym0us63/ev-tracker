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

export function filterByPeriod(charges, period) {
  if (period === 'all') return charges
  const now = new Date(), cutoff = new Date()
  if (period === '30d')   cutoff.setDate(now.getDate() - 30)
  if (period === '12m')   cutoff.setMonth(now.getMonth() - 12)
  if (period === '7d')    cutoff.setDate(now.getDate() - 7)
  if (period === 'month') cutoff.setDate(1)
  if (period === 'year')  { cutoff.setMonth(0); cutoff.setDate(1) }
  if (period === '3m')    cutoff.setMonth(now.getMonth() - 3)
  return charges.filter(c => new Date(c.date) >= cutoff)
}

export function getDailyData(charges, days = 30) {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (days - 1 - i))
    const dateStr = d.toISOString().slice(0,10)
    const dc = charges.filter(c => c.date === dateStr)
    return {
      label: i % 5 === 0 ? `${d.getDate()}/${d.getMonth()+1}` : '',
      date:  dateStr,
      mg4:   dc.filter(c=>c.vehicleId==='mg4').reduce((s,c)=>s+c.kwh,0),
      xpeng: dc.filter(c=>c.vehicleId==='xpeng').reduce((s,c)=>s+c.kwh,0),
    }
  })
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
