import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LineChart, Line, AreaChart, Area, PieChart, Pie, Legend } from 'recharts'
import { computeStats, filterByPeriod, getPeriodWindow, getChartData, getProviderStats, getCardStats, getMonthlyAvgByVehicle, getWeekdayDistribution, getPowerHistogramSplit, VEHICLES, formatCost } from '../utils.js'
import PeriodNav from '../components/PeriodNav.jsx'
import OperatorLogo from '../components/OperatorLogo.jsx'
import CardLogo from '../components/CardLogo.jsx'
import ProfileMenu from '../components/ProfileMenu.jsx'

const PROVIDER_COLORS = ['#4f8ef7','#7c5cfc','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16']

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  const total = payload.reduce((s,p)=>s+(p.value||0),0)
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => p.value > 0 && <div key={p.dataKey} style={{ color:p.fill||p.stroke||'var(--text)', fontWeight:600 }}>{p.name}: {p.value.toFixed(1)} {p.unit||'kWh'}</div>)}
      {payload.length > 1 && total > 0 && <div style={{ color:'var(--text)', fontWeight:700, marginTop:3, borderTop:'1px solid var(--border)', paddingTop:3 }}>Total: {total.toFixed(1)}{payload[0]?.unit||' kWh'}</div>}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

function AcDcTile({ label, valAC, valDC, suffix, color }) {
  return (
    <div className="card" style={{ padding:'9px 10px', gridColumn:'span 2' }}>
      <div style={{ fontSize:8, color:'var(--muted)', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="mono" style={{ fontSize:12, fontWeight:700, color, lineHeight:1.25, overflowWrap:'break-word' }}>{valAC}{valAC!=='—'?` ${suffix}`:''}</div>
          <div style={{ fontSize:8, color:'var(--green)', marginTop:2 }}>🏠 AC</div>
        </div>
        <div style={{ width:1, background:'var(--border)', flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div className="mono" style={{ fontSize:12, fontWeight:700, color, lineHeight:1.25, overflowWrap:'break-word' }}>{valDC}{valDC!=='—'?` ${suffix}`:''}</div>
          <div style={{ fontSize:8, color:'var(--amber)', marginTop:2 }}>⚡ DC</div>
        </div>
      </div>
    </div>
  )
}

import CO2Tile from '../components/CO2Tile.jsx'
import SavingsTile from '../components/SavingsTile.jsx'

export default function Stats({ charges, filters, applyFilters, account, onLogout, theme, onToggleTheme, onNavigate }) {
  const [habitsBreakdown, setHabitsBreakdown] = React.useState('none') // 'none' | 'location' | 'vehicle'

  const period  = filters.period === 'all' ? 'all' : filters.period

  const filtered = useMemo(() => applyFilters(charges), [charges, filters])

  // Période précédente — pour la section comparaison
  const prevFiltered = useMemo(() => {
    const period = filters.period
    const offset = (filters.periodOffset || 0) - 1
    if (!['month','year','30d','7d'].includes(period)) return null
    const win = getPeriodWindow(period, offset)
    if (!win) return null
    const from = win.from.toISOString().slice(0,10)
    const to   = win.to.toISOString().slice(0,10)
    const base = applyFilters(charges) // garde les filtres véhicule/lieu/etc.
    // On refiltre juste la fenêtre de date
    const allWithFilters = charges.filter(c => {
      const tmp = applyFilters([c])
      return tmp.length > 0
    })
    return charges.filter(c => {
      if (c.date < from || c.date > to) return false
      // Même filtres véhicule/lieu
      if (filters.vehicles.length > 0 && !filters.vehicles.includes(c.vehicleId)) return false
      if (filters.locations.length > 0) {
        const loc = c.locationId === 'home' ? 'home' : 'ext'
        if (!filters.locations.includes(loc)) return false
      }
      return true
    })
  }, [charges, filters])

  const stats      = useMemo(() => computeStats(filtered),         [filtered])
  const statsMg4   = useMemo(() => computeStats(filtered, 'mg4'),  [filtered])
  const statsXpeng = useMemo(() => computeStats(filtered, 'xpeng'),[filtered])
  const statsAll   = stats

  const chartData  = useMemo(() => getChartData(filtered, filters.period === 'all' ? 'all' : period), [filtered, period])

  // New: monthly average per vehicle (full history, not period-filtered)
  const monthlyAvg = useMemo(() => getMonthlyAvgByVehicle(charges), [charges])
  // New: weekday distribution, power histogram (respect active period filter)
  const weekdayData = useMemo(() => getWeekdayDistribution(filtered), [filtered])
  const powerHisto   = useMemo(() => getPowerHistogramSplit(filtered), [filtered])
  const providers  = useMemo(() => getProviderStats(filtered), [filtered])
  const cards      = useMemo(() => getCardStats(filtered), [filtered])

  // Fuel savings & thermal comparison — all charges
  const totalFuel    = filtered.reduce((s,c)=>s+(c.fuelSavings||0),0)
  const totalCostAll = filtered.reduce((s,c)=>s+(c.totalCost||0),0)
  const equivalentFuel = totalFuel + totalCostAll

  // CO2 évité — thermique vs réseau électrique français (~52g/kWh nucléaire)
  const CO2_GRID_KG_PER_KWH = 0.052  // mix FR, source RTE
  const CO2_PER_LITRE = { mg4: 2.28, xpeng: 2.65 }  // SP95: 2.28 kg/L, Gazole: 2.65 kg/L
  const VEHICLE_CFG   = { mg4: { kwhPer100: 14.5, litresPer100: 6.0 }, xpeng: { kwhPer100: 16.0, litresPer100: 7.5 } }
  const totalCO2Saved = filtered.reduce((sum, c) => {
    const v = VEHICLE_CFG[c.vehicleId]
    if (!v || !c.kwh) return sum
    const litres     = (c.kwh / v.kwhPer100) * v.litresPer100
    const co2Therm   = litres * (CO2_PER_LITRE[c.vehicleId] || 2.28)
    const co2Grid    = c.kwh * CO2_GRID_KG_PER_KWH
    return sum + (co2Therm - co2Grid)
  }, 0)
  const sp95Prices   = filtered.filter(c => c.fuelTypeUsed === 'sp95'   && c.fuelPriceUsed != null).map(c => c.fuelPriceUsed)
  const gazolePrices = filtered.filter(c => c.fuelTypeUsed === 'gazole' && c.fuelPriceUsed != null).map(c => c.fuelPriceUsed)
  const avgSp95   = sp95Prices.length   ? sp95Prices.reduce((a,b)=>a+b,0)/sp95Prices.length     : null
  const avgGazole = gazolePrices.length ? gazolePrices.reduce((a,b)=>a+b,0)/gazolePrices.length : null

  // Évolution du prix carburant dans le temps — un seul jeu de données fusionné
  // (point commun par date) pour que l'axe Y et le tooltip prennent en compte
  // les deux courbes correctement (les lignes ne doivent pas avoir leur propre
  // tableau "data" séparé, sinon recharts ne sait calculer ni l'échelle ni le
  // tooltip partagé).
  const fuelEvolutionData = useMemo(() => {
    const byTime = {}
    filtered.forEach(c => {
      if (c.fuelPriceUsed == null || !c.fuelTypeUsed) return
      const t = new Date(c.date).getTime()
      if (!byTime[t]) byTime[t] = { t }
      byTime[t][c.fuelTypeUsed] = c.fuelPriceUsed
    })
    return Object.values(byTime).sort((a,b) => a.t - b.t)
  }, [filtered])
  const hasSp95Evolution   = fuelEvolutionData.some(d => d.sp95   != null)
  const hasGazoleEvolution = fuelEvolutionData.some(d => d.gazole != null)
  const hasFuelEvolution   = fuelEvolutionData.length >= 2 && (hasSp95Evolution || hasGazoleEvolution)
  // 5 ticks espacés régulièrement sur l'axe du temps, pour éviter la bouillie de dates
  const fuelEvolutionTicks = useMemo(() => {
    if (fuelEvolutionData.length < 2) return []
    const tMin = fuelEvolutionData[0].t, tMax = fuelEvolutionData[fuelEvolutionData.length-1].t
    const n = Math.min(5, fuelEvolutionData.length)
    if (n < 2) return [tMin]
    return Array.from({ length:n }, (_,i) => Math.round(tMin + (tMax-tMin)*i/(n-1)))
  }, [fuelEvolutionData])
  const fuelEvolutionYDomain = useMemo(() => {
    const vals = fuelEvolutionData.flatMap(d => [d.sp95, d.gazole]).filter(v => v != null)
    if (!vals.length) return [0, 2]
    const min = Math.min(...vals), max = Math.max(...vals)
    const pad = Math.max(0.02, (max-min) * 0.15)
    return [Math.floor((min-pad)*100)/100, Math.ceil((max+pad)*100)/100]
  }, [fuelEvolutionData])


  // Solar savings — includes Wallbox (now has solar_savings from one-time recompute)
  const totalSolar    = filtered.reduce((s,c)=>s+(c.solarSavings||0),0)
  const homeCharges   = filtered.filter(c=>c.locationId==='home')
  const solarCharges  = homeCharges.filter(c=>(c.solarSavings||0)>0.05)
  const solarPct      = homeCharges.length>0 ? Math.round(solarCharges.length/homeCharges.length*100) : 0
  const isDailyChart = period === 'month' || period === '30d'
  const chartPeriod = period === 'all' ? 'all' : period

  // Extra stats
  const savings    = filtered.reduce((s,c)=>s+(c.fuelSavings||0),0)
  const avgSession = stats.count > 0 ? (stats.totalKwh/stats.count).toFixed(1) : '—'
  const avgCost    = stats.count > 0 ? (stats.totalCost/stats.count).toFixed(2) : '—'

  const acCharges = filtered.filter(c => c.locationId === 'home')
  const dcCharges = filtered.filter(c => c.locationId !== 'home')

  const avgSessionAC = acCharges.length ? (acCharges.reduce((s,c)=>s+(c.kwh||0),0)/acCharges.length).toFixed(1) : '—'
  const avgSessionDC = dcCharges.length ? (dcCharges.reduce((s,c)=>s+(c.kwh||0),0)/dcCharges.length).toFixed(1) : '—'
  const avgCostAC = acCharges.length ? (acCharges.reduce((s,c)=>s+(c.totalCost||0),0)/acCharges.length).toFixed(2) : '—'
  const avgCostDC = dcCharges.length ? (dcCharges.reduce((s,c)=>s+(c.totalCost||0),0)/dcCharges.length).toFixed(2) : '—'
  const avgPriceAC = acCharges.reduce((s,c)=>s+(c.kwh||0),0) > 0
    ? (acCharges.reduce((s,c)=>s+(c.totalCost||0),0) / acCharges.reduce((s,c)=>s+(c.kwh||0),0)).toFixed(3) : '—'
  const avgPriceDC = dcCharges.reduce((s,c)=>s+(c.kwh||0),0) > 0
    ? (dcCharges.reduce((s,c)=>s+(c.totalCost||0),0) / dcCharges.reduce((s,c)=>s+(c.kwh||0),0)).toFixed(3) : '—'

  const avgPwr     = useMemo(() => {
    const w = filtered.filter(c=>c.durationMin>0)
    if (!w.length) return null
    return (w.reduce((s,c)=>s+c.kwh,0) / w.reduce((s,c)=>s+c.durationMin/60,0)).toFixed(1)
  }, [filtered])
  const avgPwrHome = useMemo(() => {
    const w = filtered.filter(c=>c.locationId==='home'&&c.durationMin>0)
    if (!w.length) return null
    return (w.reduce((s,c)=>s+c.kwh,0) / w.reduce((s,c)=>s+c.durationMin/60,0)).toFixed(1)
  }, [filtered])
  const avgPwrDC = useMemo(() => {
    const w = filtered.filter(c=>c.locationId!=='home'&&c.durationMin>0)
    if (!w.length) return null
    return (w.reduce((s,c)=>s+c.kwh,0) / w.reduce((s,c)=>s+c.durationMin/60,0)).toFixed(1)
  }, [filtered])


  const maxSession = filtered.length ? Math.max(...filtered.map(c=>c.kwh)).toFixed(1) : '—'
  const maxCost    = filtered.length ? Math.max(...filtered.map(c=>c.totalCost||0)).toFixed(2) : '—'
  const maxSessionAC = acCharges.length ? Math.max(...acCharges.map(c=>c.kwh||0)).toFixed(1) : '—'
  const maxSessionDC = dcCharges.length ? Math.max(...dcCharges.map(c=>c.kwh||0)).toFixed(1) : '—'
  const maxCostAC = acCharges.length ? Math.max(...acCharges.map(c=>c.totalCost||0)).toFixed(2) : '—'
  const maxCostDC = dcCharges.length ? Math.max(...dcCharges.map(c=>c.totalCost||0)).toFixed(2) : '—'
  const topProvider = useMemo(() => {
    const map = {}
    filtered.filter(c=>c.locationId!=='home'&&c.provider).forEach(c=>{map[c.provider]=(map[c.provider]||0)+1})
    const top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0]
    return top ? `${top[0]} (${top[1]})` : '—'
  }, [filtered])
  const homePct = stats.totalKwh > 0 ? Math.round(stats.homeKwh/stats.totalKwh*100) : 0
  const extPct  = stats.totalKwh > 0 ? Math.round(stats.extKwh/stats.totalKwh*100) : 0

  // Cost over time for line chart
  const costData = useMemo(() => {
    const d = getChartData(filtered, period)
    let cum = 0
    return d.map((row, idx) => {
      let dc
      if (row.date) {
        dc = filtered.filter(c => c.date === row.date)
      } else if (period === 'all') {
        dc = filtered.filter(c => c.date.startsWith(row.label))
      } else {
        const now = new Date()
        const monthsBack = d.length - 1 - idx
        const target = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
        const y = target.getFullYear()
        const m = String(target.getMonth() + 1).padStart(2, '0')
        dc = filtered.filter(c => c.date.startsWith(`${y}-${m}`))
      }
      const mg4Cost   = dc.filter(c=>c.vehicleId==='mg4').reduce((s,c)=>s+(c.totalCost||0),0)
      const xpengCost = dc.filter(c=>c.vehicleId==='xpeng').reduce((s,c)=>s+(c.totalCost||0),0)
      const cost = mg4Cost + xpengCost
      cum += cost
      return { ...row, mg4: parseFloat(mg4Cost.toFixed(2)), xpeng: parseFloat(xpengCost.toFixed(2)), cost: parseFloat(cost.toFixed(2)), cumCost: parseFloat(cum.toFixed(2)) }
    })
  }, [filtered, period, filters.period])

  return (
    <div className="page fade-up" style={{ paddingBottom:100 }}>
      <div style={{ padding:'16px 20px 8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Statistiques</div>
        <ProfileMenu account={account} onNavigate={onNavigate} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      </div>

      <PeriodNav filters={filters} setFilters={setFilters} />

      {filtered.length === 0 ? (
        <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Aucune session sur cette période.</div>
      ) : (<>

      {/* Comparaison période précédente */}
      {prevFiltered && prevFiltered.length >= 0 && (() => {
        const curr = computeStats(filtered)
        const prev = computeStats(prevFiltered)
        const delta = (a, b, unit='', inv=false) => {
          if (b === 0 && a === 0) return null
          const d = a - b
          const pct = b !== 0 ? Math.round(d/b*100) : null
          const pos = inv ? d < 0 : d >= 0
          return { d, pct, pos, label: `${d >= 0 ? '+' : ''}${unit === '€' ? d.toFixed(0) : d.toFixed(1)}${unit}${pct !== null ? ` (${d >= 0 ? '+' : ''}${pct}%)` : ''}` }
        }
        const rows = [
          { label:'Sessions',   curr:curr.count,         prev:prev.count,         unit:'',   fmt:v=>v },
          { label:'kWh',        curr:curr.totalKwh,      prev:prev.totalKwh,      unit:' kWh', fmt:v=>v.toFixed(1) },
          { label:'Coût',       curr:curr.totalCost,     prev:prev.totalCost,     unit:'€',  fmt:v=>v.toFixed(0), inv:true },
          { label:'Économies',  curr:filtered.reduce((s,c)=>s+(c.fuelSavings||0),0), prev:prevFiltered.reduce((s,c)=>s+(c.fuelSavings||0),0), unit:'€', fmt:v=>v.toFixed(0) },
        ]
        return (
          <div style={{ margin:'10px 16px 0', padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)' }}>
            <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>vs période précédente</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
              {rows.map(r => {
                const d = delta(r.curr, r.prev, r.unit, r.inv)
                return (
                  <div key={r.label} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9, color:'var(--muted)', marginBottom:3 }}>{r.label}</div>
                    <div className="mono" style={{ fontSize:13, fontWeight:700 }}>{r.fmt(r.curr)}<span style={{ fontSize:9, color:'var(--muted)', marginLeft:1 }}>{r.unit}</span></div>
                    {d && <div style={{ fontSize:9, fontWeight:700, color: d.pos ? 'var(--green)' : 'var(--red)', marginTop:2 }}>{d.label}</div>}
                    {!d && <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>—</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

        {/* Main KPIs 2x2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'12px 16px 0' }}>
          {[
            { val:`${stats.totalKwh.toFixed(0)} kWh`, label:'Énergie totale',    color:'var(--accent)', mono:true },
            { val:formatCost(stats.totalCost),         label:'Coût total',        color:'var(--green)', mono:true },
            { val:`${stats.count}`,                    label:`Session${stats.count>1?'s':''}`, color:'var(--text)' },
            { val:`${stats.avgPrice > 0 ? stats.avgPrice.toFixed(3) : '—'} €/kWh`, label:'Prix moyen',  color:'var(--muted)', mono:true },
          ].map(k => (
            <div key={k.label} className="card">
              <div className={k.mono?'mono':''} style={{ fontSize:22, fontWeight:700, color:k.color, lineHeight:1.1 }}>{k.val}</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Économies */}
        {savings !== 0 && (
          <div style={{ margin:'8px 16px 0', background: savings >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${savings >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius:'var(--r-sm)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>Économies vs thermique</div>
              <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>MG4 (206, 6L/100) · Xpeng (Cruze diesel, 7.5L/100)</div>
            </div>
            <div className="mono" style={{ fontSize:22, fontWeight:700, color: savings >= 0 ? 'var(--green)' : 'var(--red)' }}>{savings >= 0 ? '+' : ''}{savings.toFixed(0)} €</div>
          </div>
        )}

        {/* Grid KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:7, margin:'8px 16px 0' }}>
          <AcDcTile label="kWh/session" valAC={avgSessionAC} valDC={avgSessionDC} suffix="kWh" color="var(--mg4)" />
          <AcDcTile label="€/session"   valAC={avgCostAC}    valDC={avgCostDC}    suffix="€"   color="var(--xpeng)" />
          <AcDcTile label="Puissance moy." valAC={avgPwrHome||'—'} valDC={avgPwrDC||'—'} suffix="kW" color="var(--accent)" />
          <AcDcTile label="Session la + chère" valAC={maxCostAC} valDC={maxCostDC} suffix="€" color="var(--amber)" />
          {[
            { val:`${maxSession}`, label:'Max kWh',      color:'var(--accent)', mono:true },
            { val:`${homePct}%`,   label:'Maison',       color:'var(--green)' },
            { val:`${extPct}%`,    label:'Externe',      color:'var(--amber)' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding:'9px 10px' }}>
              <div className={k.mono?'mono':''} style={{ fontSize:14, fontWeight:700, color:k.color, lineHeight:1 }}>{k.val}</div>
              <div style={{ fontSize:8, color:'var(--muted)', marginTop:3, lineHeight:1.3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Vehicle comparison */}
        <div style={{ padding:'12px 16px 0' }}>
          <SectionLabel>Par véhicule</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {[{v:VEHICLES.mg4,s:statsMg4},{v:VEHICLES.xpeng,s:statsXpeng}].filter(({s})=>s.count>0).map(({v,s}) => (
              <div key={v.id} className="card" style={{ padding:'12px 16px', border:`1px solid ${v.color}22` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{v.emoji}</span>
                    <div>
                      <div style={{ fontWeight:600, color:v.color, fontSize:13 }}>{v.name}</div>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>{s.count} sess. · {s.avgPrice > 0 ? s.avgPrice.toFixed(3) : '—'} €/kWh</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="mono" style={{ fontWeight:700 }}>{s.totalKwh.toFixed(0)} kWh</div>
                    <div className="mono" style={{ fontSize:12, color:'var(--green)' }}>{formatCost(s.totalCost)}</div>
                  </div>
                </div>
                <div style={{ marginTop:10, display:'flex', gap:4 }}>
                  <div style={{ flex:s.homeKwh||0.001, height:4, borderRadius:2, background:'var(--green)', opacity:.8 }} />
                  <div style={{ flex:s.extKwh||0.001, height:4, borderRadius:2, background:'var(--amber)', opacity:.8 }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:'var(--muted)' }}>
                  <span>🏠 {s.homeKwh.toFixed(0)} kWh ({s.totalKwh > 0 ? Math.round(s.homeKwh/s.totalKwh*100) : 0}%)</span>
                  <span>{s.extKwh.toFixed(0)} kWh ({s.totalKwh > 0 ? Math.round(s.extKwh/s.totalKwh*100) : 0}%) 📍</span>
                </div>
                {statsAll.totalKwh > 0 && (
                  <div style={{ marginTop:8, height:3, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:v.color, width:`${(s.totalKwh/statsAll.totalKwh*100).toFixed(0)}%`, borderRadius:3 }} />
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>

        {/* Répartition camemberts: véhicule + lieu */}
        {statsAll.totalKwh > 0 && (
          <div style={{ padding:'12px 16px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {(() => {
              const vehiclePieData = [
                { name:'MG4', value: statsMg4.totalKwh, color:'var(--mg4)' },
                { name:'Xpeng G6', value: statsXpeng.totalKwh, color:'var(--xpeng)' },
              ].filter(d => d.value > 0)
              const locPieData = [
                { name:'Maison', value: statsAll.homeKwh, color:'var(--green)' },
                { name:'Externe', value: statsAll.extKwh, color:'var(--amber)' },
              ].filter(d => d.value > 0)
              return (
                <>
                  <div className="card" style={{ padding:'10px' }}>
                    <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2, textAlign:'center' }}>Par véhicule</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={vehiclePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                          {vehiclePieData.map((d,i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v)=>`${v.toFixed(0)} kWh`} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:2 }}>
                      {vehiclePieData.map((d,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'var(--muted)' }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', background:d.color }} />{d.name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card" style={{ padding:'10px' }}>
                    <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2, textAlign:'center' }}>Maison / Externe</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={locPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                          {locPieData.map((d,i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v)=>`${v.toFixed(0)} kWh`} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:2 }}>
                      {locPieData.map((d,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'var(--muted)' }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', background:d.color }} />{d.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* Monthly average per vehicle (full history) */}
        {(monthlyAvg.mg4.months > 0 || monthlyAvg.xpeng.months > 0) && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Moyenne mensuelle par véhicule</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {Object.entries(VEHICLES).map(([vid, v]) => {
                const m = monthlyAvg[vid]
                if (!m || m.months === 0) return null
                return (
                  <div key={vid} className="card" style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                      <span style={{ fontSize:14 }}>{v.emoji}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:v.color }}>{v.name}</span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div className="mono" style={{ fontSize:16, fontWeight:700, color:v.color }}>{m.kwh.toFixed(0)} kWh</div>
                        <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>par mois</div>
                      </div>
                      <div style={{ width:1, background:'var(--border)' }} />
                      <div style={{ flex:1 }}>
                        <div className="mono" style={{ fontSize:16, fontWeight:700, color:v.color }}>{m.cost.toFixed(0)} €</div>
                        <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>par mois</div>
                      </div>
                    </div>
                    <div style={{ fontSize:8, color:'var(--muted)', marginTop:8 }}>sur {m.months} mois d'historique</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(totalSolar > 0 || totalFuel !== 0 || avgSp95 != null || avgGazole != null) && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Économies réalisées</SectionLabel>
            <div className="card" style={{ padding:'16px' }}>

              {/* Ligne 1 : gain thermique + gain solaire */}
              <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                {totalFuel !== 0 && (
                  <div style={{ flex:1, minWidth:120, padding:'10px 14px', background: totalFuel >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderRadius:'var(--r-sm)', border: `1px solid ${totalFuel >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4 }}>🚗 vs thermique</div>
                    <div className="mono" style={{ fontSize:18, fontWeight:700, color: totalFuel >= 0 ? 'var(--green)' : 'var(--red)' }}>{totalFuel >= 0 ? '+' : ''}{totalFuel.toFixed(0)} €</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>soit {((Math.abs(totalFuel)/(totalCostAll||1))*100).toFixed(0)}% du coût EV</div>
                  </div>
                )}
                {totalSolar > 0.1 && (
                  <div style={{ flex:1, minWidth:120, padding:'10px 14px', background:'rgba(251,191,36,0.08)', borderRadius:'var(--r-sm)', border:'1px solid rgba(251,191,36,0.2)' }}>
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4 }}>☀️ gain solaire</div>
                    <div className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--amber)' }}>{totalSolar.toFixed(1)} €</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{solarPct}% charges maison avec PV</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>soit ~{(totalSolar/0.14).toFixed(0)} kWh solaire</div>
                  </div>
                )}
              </div>

              {/* Ligne 2 : SP95 moyen + Gazole moyen côte à côte */}
              {(avgSp95 != null || avgGazole != null) && (
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  {avgSp95 != null && (
                    <div style={{ flex:1, padding:'10px 14px', background:'rgba(79,142,247,0.08)', borderRadius:'var(--r-sm)', border:'1px solid rgba(79,142,247,0.2)' }}>
                      <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4 }}>⛽ SP95 moyen</div>
                      <div className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--mg4)' }}>{avgSp95.toFixed(3)} €/L</div>
                      <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{sp95Prices.length} session{sp95Prices.length>1?'s':''}</div>
                    </div>
                  )}
                  {avgGazole != null && (
                    <div style={{ flex:1, padding:'10px 14px', background:'rgba(124,92,252,0.08)', borderRadius:'var(--r-sm)', border:'1px solid rgba(124,92,252,0.2)' }}>
                      <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4 }}>🛢️ Gazole moyen</div>
                      <div className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--xpeng)' }}>{avgGazole.toFixed(3)} €/L</div>
                      <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{gazolePrices.length} session{gazolePrices.length>1?'s':''}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Ligne 3 : Économies en € avec équivalences concrètes */}
              {totalFuel > 0 && <SavingsTile euros={totalFuel} />}

              {/* Ligne 4 : CO₂ évité — pleine largeur avec carrousel d'équivalences */}
              {totalCO2Saved > 0 && <div style={{ marginTop:8 }}><CO2Tile kg={totalCO2Saved} /></div>}

              {/* Évolution du prix carburant dans le temps */}
              {hasFuelEvolution && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Évolution du prix carburant</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={fuelEvolutionData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                      <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']} scale="time"
                        ticks={fuelEvolutionTicks} tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false}
                        tickFormatter={t => new Date(t).toLocaleDateString('fr-FR',{ day:'2-digit', month:'short' })} />
                      <YAxis tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false}
                        domain={fuelEvolutionYDomain} tickFormatter={v => v.toFixed(2)} width={38} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const entries = payload.filter(p => p.value != null)
                        if (!entries.length) return null
                        return (
                          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
                            <div style={{ color:'var(--muted)', marginBottom:4 }}>{new Date(label).toLocaleDateString('fr-FR',{ day:'2-digit', month:'short', year:'numeric' })}</div>
                            {entries.map(p => (
                              <div key={p.dataKey} style={{ color: p.dataKey==='sp95' ? 'var(--mg4)' : 'var(--xpeng)', fontWeight:700 }}>
                                {p.dataKey==='sp95' ? 'SP95' : 'Gazole'}: {p.value.toFixed(3)} €/L
                              </div>
                            ))}
                          </div>
                        )
                      }} />
                      {hasSp95Evolution && (
                        <Line dataKey="sp95" name="SP95" type="monotone" stroke="var(--mg4)" strokeWidth={2} dot={fuelEvolutionData.length<15} connectNulls />
                      )}
                      {hasGazoleEvolution && (
                        <Line dataKey="gazole" name="Gazole" type="monotone" stroke="var(--xpeng)" strokeWidth={2} dot={fuelEvolutionData.length<15} connectNulls />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', gap:14, justifyContent:'center', marginTop:2 }}>
                    {hasSp95Evolution   && <span style={{ fontSize:9, color:'var(--mg4)', fontWeight:600 }}>● SP95</span>}
                    {hasGazoleEvolution && <span style={{ fontSize:9, color:'var(--xpeng)', fontWeight:600 }}>● Gazole</span>}
                  </div>
                </div>
              )}

              {/* Bar: EV cost vs what thermal would have cost */}
              {totalFuel > 0 && (() => {
                const equivalentFuel = totalCostAll + totalFuel
                const evPct   = Math.round(totalCostAll / equivalentFuel * 100)
                return (
                  <div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Coût EV vs équivalent thermique</div>
                    <div style={{ display:'flex', height:20, borderRadius:10, overflow:'hidden', gap:2 }}>
                      <div style={{ width:`${evPct}%`, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:9, color:'white', fontWeight:700 }}>{totalCostAll.toFixed(0)}€</span>
                      </div>
                      <div style={{ flex:1, background:'rgba(239,68,68,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:9, color:'var(--red)', fontWeight:700 }}>+{totalFuel.toFixed(0)}€ therm.</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                      <span style={{ fontSize:10, color:'var(--muted)' }}>EV : {totalCostAll.toFixed(2)} €</span>
                      <span style={{ fontSize:10, color:'var(--muted)' }}>Thermique : {equivalentFuel.toFixed(2)} €</span>
                    </div>
                  </div>
                )
              })()}

              {/* Solar sessions gauge */}
              {solarPct > 0 && (
                <div style={{ marginTop:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>Sessions maison avec solaire</span>
                    <span className="mono" style={{ fontSize:11, fontWeight:700, color:'var(--amber)' }}>{solarCharges.length}/{homeCharges.length}</span>
                  </div>
                  <div style={{ height:8, borderRadius:4, background:'var(--surface2)', overflow:'hidden' }}>
                    <div style={{ width:`${solarPct}%`, height:'100%', background:'linear-gradient(90deg,var(--amber),#f59e0b)', borderRadius:4, transition:'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>{solarPct}% des charges maison bénéficient du photovoltaïque</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Adaptive chart */}
        {chartData.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Énergie — {period==='all'?'par année':period==='year'||period==='12m'?'par mois':'par jour'}</SectionLabel>
            <div className="card" style={{ padding:'14px 16px' }}>
              <ResponsiveContainer width="100%" height={110}>
                {isDailyChart ? (
                  <BarChart data={chartData} barSize={chartData.length > 20 ? 5 : 9} barGap={1}>
                    <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:8 }} axisLine={false} tickLine={false} interval={0} />
                    <Tooltip content={<Tip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="mg4"   name="MG4"      fill="var(--mg4)"   radius={[0,0,0,0]} stackId="a" />
                    <Bar dataKey="xpeng" name="Xpeng G6" fill="var(--xpeng)" radius={[2,2,0,0]} stackId="a" />
                  </BarChart>
                ) : (
                  <BarChart data={chartData} barSize={20} barGap={3}>
                    <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="mg4"   name="MG4"      fill="var(--mg4)"   radius={[0,0,0,0]} stackId="a" />
                    <Bar dataKey="xpeng" name="Xpeng G6" fill="var(--xpeng)" radius={[3,3,0,0]} stackId="a" />
                  </BarChart>
                )}
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:14, marginTop:4, fontSize:10 }}>
                {[{c:'var(--mg4)',l:'MG4'},{c:'var(--xpeng)',l:'Xpeng G6'}].map(i=>(
                  <div key={i.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:i.c }} />{i.l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cost chart */}
        {costData.filter(d=>d.cost>0).length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Coût — {period==='all'?'par année':period==='year'||period==='12m'?'par mois':'par jour'}</SectionLabel>
            <div className="card" style={{ padding:'14px 16px' }}>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={costData} barSize={isDailyChart ? (costData.length>20?5:9) : 20}>
                  <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:8 }} axisLine={false} tickLine={false} interval={isDailyChart?0:'preserveStartEnd'} />
                  <Tooltip content={<Tip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="mg4"   name="MG4"      unit=" €" fill="var(--mg4)"   radius={[0,0,0,0]} stackId="a" opacity={0.85} />
                  <Bar dataKey="xpeng" name="Xpeng G6" unit=" €" fill="var(--xpeng)" radius={[3,3,0,0]} stackId="a" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weekday distribution */}
        {weekdayData.some(d => d.sessions > 0) && (
          <div style={{ padding:'12px 16px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <SectionLabel>Habitudes — jour de la semaine</SectionLabel>
              <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                {[{id:'none',label:'Total'},{id:'location',label:'Lieu'},{id:'vehicle',label:'Véhicule'}].map(o => (
                  <button key={o.id} onClick={()=>setHabitsBreakdown(o.id)} style={{ padding:'3px 9px', borderRadius:12, border:`1px solid ${habitsBreakdown===o.id?'var(--accent)':'var(--border)'}`, background:habitsBreakdown===o.id?'rgba(79,142,247,0.1)':'transparent', color:habitsBreakdown===o.id?'var(--accent)':'var(--muted)', fontSize:9, fontWeight:600, cursor:'pointer' }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding:'14px 16px' }}>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={weekdayData}>
                  <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v)=>`${v.toFixed(0)} kWh`} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} />
                  {habitsBreakdown === 'none' && <Bar dataKey="kwh" radius={[4,4,0,0]} fill="var(--accent)" />}
                  {habitsBreakdown === 'location' && <>
                    <Bar dataKey="homeKwh" name="Maison" stackId="a" fill="var(--green)" radius={[0,0,0,0]} />
                    <Bar dataKey="extKwh" name="Externe" stackId="a" fill="var(--amber)" radius={[4,4,0,0]} />
                  </>}
                  {habitsBreakdown === 'vehicle' && <>
                    <Bar dataKey="mg4Kwh" name="MG4" stackId="a" fill="var(--mg4)" radius={[0,0,0,0]} />
                    <Bar dataKey="xpengKwh" name="Xpeng G6" stackId="a" fill="var(--xpeng)" radius={[4,4,0,0]} />
                  </>}
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize:9, color:'var(--muted)', textAlign:'center', marginTop:4 }}>kWh chargés par jour de la semaine</div>
            </div>
          </div>
        )}

        {/* Power histogram — séparé Maison (kW AC) / Externe (kW DC), échelles très différentes */}
        {(powerHisto.home.length > 0 || powerHisto.ext.length > 0) && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Répartition par puissance</SectionLabel>
            <div style={{ display:'flex', gap:10 }}>
              {powerHisto.home.length > 0 && (
                <div className="card" style={{ padding:'14px 16px', flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, color:'var(--green)', fontWeight:600, marginBottom:6 }}>🏠 Maison</div>
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={powerHisto.home}>
                      <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v)=>`${v} session(s)`} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} />
                      {habitsBreakdown !== 'vehicle' && <Bar dataKey="count" radius={[4,4,0,0]} fill="var(--green)" />}
                      {habitsBreakdown === 'vehicle' && <>
                        <Bar dataKey="mg4Count" name="MG4" stackId="a" fill="var(--mg4)" radius={[0,0,0,0]} />
                        <Bar dataKey="xpengCount" name="Xpeng G6" stackId="a" fill="var(--xpeng)" radius={[4,4,0,0]} />
                      </>}
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize:8, color:'var(--muted)', textAlign:'center', marginTop:4 }}>kW</div>
                </div>
              )}
              {powerHisto.ext.length > 0 && (
                <div className="card" style={{ padding:'14px 16px', flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, color:'var(--amber)', fontWeight:600, marginBottom:6 }}>⚡ Externe</div>
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={powerHisto.ext}>
                      <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v)=>`${v} session(s)`} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} />
                      {habitsBreakdown !== 'vehicle' && <Bar dataKey="count" radius={[4,4,0,0]} fill="var(--amber)" />}
                      {habitsBreakdown === 'vehicle' && <>
                        <Bar dataKey="mg4Count" name="MG4" stackId="a" fill="var(--mg4)" radius={[0,0,0,0]} />
                        <Bar dataKey="xpengCount" name="Xpeng G6" stackId="a" fill="var(--xpeng)" radius={[4,4,0,0]} />
                      </>}
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize:8, color:'var(--muted)', textAlign:'center', marginTop:4 }}>kW</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Solar & Savings section */}
        {/* Monthly cost cumulative trend */}
        {period === 'all' && costData.length > 1 && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Coût cumulé</SectionLabel>
            <div className="card" style={{ padding:'14px 16px' }}>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={costData}>
                  <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Area dataKey="cumCost" name="Cumul" unit=" €" stroke="var(--accent)" fill="rgba(79,142,247,0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Provider bars */}
        {providers.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Fournisseurs externes</SectionLabel>
            <div className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:9 }}>
              {providers.slice(0,15).map((d,i) => {
                const pct = Math.round(d.kwh/providers.reduce((s,x)=>s+x.kwh,0)*100)
                return (
                  <div key={d.name}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                      <OperatorLogo name={d.name} size={16} />
                      <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                      <span style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{d.sessions} sess.</span>
                      <span className="mono" style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{d.kwh.toFixed(0)} kWh</span>
                      <span className="mono" style={{ fontSize:10, fontWeight:700, color:PROVIDER_COLORS[i%PROVIDER_COLORS.length], flexShrink:0, minWidth:28, textAlign:'right' }}>{pct}%</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:'var(--surface2)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, background:PROVIDER_COLORS[i%PROVIDER_COLORS.length], transition:'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cards used */}
        {cards.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Cartes utilisées</SectionLabel>
            <div className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:9 }}>
              {cards.slice(0,15).map((d,i) => {
                const pct = Math.round(d.kwh/cards.reduce((s,x)=>s+x.kwh,0)*100)
                return (
                  <div key={d.name}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                      <CardLogo name={d.name} size={16} />
                      <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                      <span style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{d.sessions} sess.</span>
                      <span className="mono" style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{d.kwh.toFixed(0)} kWh</span>
                      <span className="mono" style={{ fontSize:10, fontWeight:700, color:PROVIDER_COLORS[i%PROVIDER_COLORS.length], flexShrink:0, minWidth:28, textAlign:'right' }}>{pct}%</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:'var(--surface2)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, background:PROVIDER_COLORS[i%PROVIDER_COLORS.length], transition:'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Price per provider */}
        {providers.length > 0 && (
          <div style={{ padding:'0 16px 0' }}>
            <SectionLabel>Prix moyen €/kWh par fournisseur</SectionLabel>
            <div className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:8 }}>
              {[...providers]
                .filter(d => d.kwh > 0)
                .map(d => ({ ...d, avgPrice: d.cost / d.kwh }))
                .sort((a,b) => a.avgPrice - b.avgPrice)
                .map((d, i) => (
                  <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <OperatorLogo name={d.name} size={18} />
                    <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                    <span style={{ fontSize:10, color:'var(--muted)', marginRight:4 }}>{d.sessions} sess.</span>
                    <span className="mono" style={{ fontSize:13, fontWeight:700, color: d.avgPrice < 0.25 ? 'var(--green)' : d.avgPrice < 0.45 ? 'var(--accent)' : 'var(--amber)' }}>{d.avgPrice.toFixed(3)} €/kWh</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Price per card */}
        {(() => {
          const cardStats = {}
          filtered.forEach(c => {
            const card = c.card || 'Sans carte'
            if (!cardStats[card]) cardStats[card] = { kwh:0, cost:0, sessions:0 }
            cardStats[card].kwh     += c.kwh
            cardStats[card].cost    += c.totalCost||0
            cardStats[card].sessions++
          })
          const cards = Object.entries(cardStats)
            .filter(([,v]) => v.kwh > 0 && v.cost > 0)
            .map(([name,v]) => ({ name, ...v, avgPrice: v.cost/v.kwh }))
            .sort((a,b) => a.avgPrice - b.avgPrice)
          if (!cards.length) return null
          return (
            <div style={{ padding:'0 16px 0' }}>
              <SectionLabel>Prix moyen €/kWh par carte</SectionLabel>
              <div className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                {cards.map(d => (
                  <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <CardLogo name={d.name} size={16} />
                    <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                    <span style={{ fontSize:10, color:'var(--muted)', marginRight:4 }}>{d.sessions} sess.</span>
                    <span className="mono" style={{ fontSize:13, fontWeight:700, color: d.avgPrice < 0.25 ? 'var(--green)' : d.avgPrice < 0.45 ? 'var(--accent)' : 'var(--amber)' }}>{d.avgPrice.toFixed(3)} €/kWh</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

      </>)}
    </div>
  )
}
