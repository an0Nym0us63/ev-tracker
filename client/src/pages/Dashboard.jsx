import React, { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie, AreaChart, Area, YAxis } from 'recharts'
import { computeStats, filterByPeriod, getChartData, getProviderStats, getMonthlyAvgByVehicle, formatCost, formatDate, formatDuration, VEHICLES } from '../utils.js'
import { apiGetAlerts } from '../api.js'
import OperatorLogo from '../components/OperatorLogo.jsx'
import CardLogo from '../components/CardLogo.jsx'
import AppLogo from '../components/AppLogo.jsx'

const PROVIDER_COLORS = ['#4f8ef7','#7c5cfc','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16']

const PERIODS = [
  { id:'month', label:'Ce mois',     accent:'#4f8ef7' },
  { id:'year',  label:'Cette année', accent:'#7c5cfc' },
  { id:'30d',   label:'30 jours',    accent:'#22c55e' },
  { id:'12m',   label:'12 mois',     accent:'#f59e0b' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s,p)=>s+(p.value||0),0)
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => p.value > 0 && (
        <div key={p.dataKey} style={{ color:p.fill||p.stroke, fontWeight:600 }}>
          {p.dataKey==='mg4'?'MG4':'Xpeng G6'}: {p.value.toFixed(1)} kWh
        </div>
      ))}
      {payload.length > 1 && total > 0 && <div style={{ color:'var(--text)', fontWeight:700, marginTop:3, borderTop:'1px solid var(--border)', paddingTop:3 }}>Total: {total.toFixed(1)} kWh</div>}
    </div>
  )
}

function avgPowerFor(charges, locationId) {
  const s = locationId === 'home'
    ? charges.filter(c => c.vehicleId && c.locationId === 'home' && c.durationMin > 0)
    : charges.filter(c => c.vehicleId && c.locationId !== 'home' && c.durationMin > 0)
  if (!s.length) return null
  const kwhT = s.reduce((a,c)=>a+c.kwh,0)
  const hT   = s.reduce((a,c)=>a+c.durationMin/60,0)
  return hT > 0 ? (kwhT/hT).toFixed(1) : null
}

function VehicleCard({ v, charges, allStats, selected, onClick }) {
  const vCharges   = charges.filter(c => c.vehicleId === v.id)
  const stats      = {
    totalKwh:  vCharges.reduce((s,c)=>s+c.kwh,0),
    totalCost: vCharges.reduce((s,c)=>s+(c.totalCost||0),0),
    count:     vCharges.length,
    homeKwh:   vCharges.filter(c=>c.locationId==='home').reduce((s,c)=>s+c.kwh,0),
    extKwh:    vCharges.filter(c=>c.locationId!=='home').reduce((s,c)=>s+c.kwh,0),
  }
  const isSelected      = selected === v.id
  const isOtherSelected = selected && selected !== v.id
  const totalPct  = allStats.totalKwh > 0 ? Math.round(stats.totalKwh / allStats.totalKwh * 100) : 0
  const homePct   = stats.totalKwh > 0 ? Math.round(stats.homeKwh / stats.totalKwh * 100) : 0
  const extPct    = stats.totalKwh > 0 ? Math.round(stats.extKwh  / stats.totalKwh * 100) : 0
  const pwrHome   = avgPowerFor(vCharges, 'home')
  const pwrDC     = avgPowerFor(vCharges, 'ext')

  return (
    <div onClick={onClick} style={{
      flex:1, background:'var(--surface)', borderRadius:'var(--r-sm)', padding:'12px 14px', cursor:'pointer',
      border: isSelected ? `2px solid ${v.color}` : '1.5px solid var(--border)',
      boxShadow: isSelected ? `0 0 18px ${v.color}44` : 'none',
      opacity: isOtherSelected ? 0.55 : 1,
      transition:'all 0.15s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <span style={{ fontSize:18 }}>{v.emoji}</span>
        <span style={{ fontSize:12, fontWeight:700, color:v.color }}>{v.name}</span>
        <span style={{ marginLeft:'auto', fontSize:11, fontWeight:600, color:v.color, background:`${v.color}18`, padding:'2px 6px', borderRadius:20 }}>{totalPct}%</span>
      </div>
      <div className="mono" style={{ fontSize:20, fontWeight:700 }}>{stats.totalKwh.toFixed(0)}<span style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}> kWh</span></div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{stats.count} sess.</span>
        <span className="mono" style={{ fontSize:11, fontWeight:600, color:'var(--green)' }}>{stats.totalCost.toFixed(2)} €</span>
      </div>
      {stats.totalKwh > 0 && (
        <>
          {/* Home/ext bar with % */}
          <div style={{ marginTop:8, display:'flex', gap:2 }}>
            <div style={{ flex:homePct||0.001, height:3, borderRadius:2, background:'var(--green)', opacity:.85 }} />
            <div style={{ flex:extPct||0.001,  height:3, borderRadius:2, background:'var(--amber)', opacity:.85 }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
            <span style={{ fontSize:9, color:'var(--green)', fontWeight:600 }}>🏠 {homePct}%</span>
            <span style={{ fontSize:9, color:'var(--amber)', fontWeight:600 }}>{extPct}% 📍</span>
          </div>
          {/* Avg power */}
          {(pwrHome || pwrDC) && (
            <div style={{ marginTop:7, display:'flex', gap:6 }}>
              {pwrHome && (
                <div style={{ flex:1, background:'rgba(34,197,94,0.08)', borderRadius:6, padding:'4px 7px' }}>
                  <div className="mono" style={{ fontSize:11, fontWeight:700, color:'var(--green)' }}>{pwrHome} kW</div>
                  <div style={{ fontSize:8, color:'var(--muted)' }}>AC maison</div>
                </div>
              )}
              {pwrDC && (
                <div style={{ flex:1, background:'rgba(251,191,36,0.08)', borderRadius:6, padding:'4px 7px' }}>
                  <div className="mono" style={{ fontSize:11, fontWeight:700, color:'var(--amber)' }}>{pwrDC} kW</div>
                  <div style={{ fontSize:8, color:'var(--muted)' }}>DC externe</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProviderChart({ charges }) {
  const data = useMemo(() => getProviderStats(charges).slice(0,15), [charges])
  if (data.length === 0) return null
  const total = data.reduce((s,d)=>s+d.kwh,0)
  const useDonut = data.length <= 4

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div className="section-label">Répartition fournisseurs (externe)</div>
      {false ? null : (
        // Horizontal bar chart for many providers
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:4 }}>
          {data.map((d,i) => {
            const pct = Math.round(d.kwh/total*100)
            return (
              <div key={d.name}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <OperatorLogo name={d.name} size={14} />
                  <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{d.name}</span>
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
      )}
    </div>
  )
}

export default function Dashboard({ charges, account, onNavigate, onNavigateAlert, onLogout, theme, onToggleTheme, filters, applyFilters }) {
  const [activePeriod,  setActivePeriod]  = useState(null)
  const [activeVehicle, setActiveVehicle] = useState(null)
  const [alerts, setAlerts] = useState([])

  useEffect(() => { apiGetAlerts().then(setAlerts).catch(()=>{}) }, [charges])

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })

  // Global filters (date/provider/card/vehicle/location) applied first
  const globallyFiltered = useMemo(() => applyFilters ? applyFilters(charges) : charges, [charges, filters, applyFilters])

  // Banner stats — always global (within the globally-filtered set)
  const periodStats = useMemo(() => PERIODS.map(p => ({
    ...p, stats: computeStats(filterByPeriod(globallyFiltered, p.id))
  })), [globallyFiltered])

  // Main filtered
  const filtered = useMemo(() => {
    let c = activePeriod ? filterByPeriod(globallyFiltered, activePeriod) : globallyFiltered
    if (activeVehicle) c = c.filter(x => x.vehicleId === activeVehicle)
    return c
  }, [globallyFiltered, activePeriod, activeVehicle])

  // Period-only (for vehicle cards comparison)
  const periodFiltered = useMemo(() => {
    return activePeriod ? filterByPeriod(globallyFiltered, activePeriod) : globallyFiltered
  }, [globallyFiltered, activePeriod])

  const stats      = useMemo(() => computeStats(filtered),          [filtered])
  const statsAll   = useMemo(() => computeStats(periodFiltered),          [periodFiltered])

  // Adaptive chart
  const chartData = useMemo(() => getChartData(filtered, activePeriod || 'all'), [filtered, activePeriod])
  const isDailyChart = activePeriod === 'month' || activePeriod === '30d'

  const sorted = useMemo(() => [...charges].sort((a,b) => {
    const dateCmp = b.date.localeCompare(a.date)
    if (dateCmp !== 0) return dateCmp
    return (b.startTime||'').localeCompare(a.startTime||'')
  }), [charges])
  const recentFiltered = useMemo(() => {
    let c = sorted
    if (activePeriod) c = c.filter(x => filterByPeriod([x], activePeriod).length > 0)
    if (activeVehicle) c = c.filter(x => x.vehicleId === activeVehicle)
    return c.slice(0, 8)
  }, [sorted, activePeriod, activeVehicle])

  // KPIs
  const extPct     = stats.totalKwh > 0 ? Math.round(stats.extKwh/stats.totalKwh*100) : 0
  const homePct    = stats.totalKwh > 0 ? Math.round(stats.homeKwh/stats.totalKwh*100) : 0
  const avgSession = stats.count > 0 ? (stats.totalKwh/stats.count).toFixed(1) : '—'
  const avgCost    = stats.count > 0 ? (stats.totalCost/stats.count).toFixed(2) : '—'

  // AC (home) / DC (external) breakdowns
  const acCharges = filtered.filter(c => c.locationId === 'home')
  const dcCharges = filtered.filter(c => c.locationId !== 'home')
  const avgSessionAC = acCharges.length ? (acCharges.reduce((s,c)=>s+(c.kwh||0),0)/acCharges.length).toFixed(1) : '—'
  const avgSessionDC = dcCharges.length ? (dcCharges.reduce((s,c)=>s+(c.kwh||0),0)/dcCharges.length).toFixed(1) : '—'
  const avgCostAC = acCharges.length ? (acCharges.reduce((s,c)=>s+(c.totalCost||0),0)/acCharges.length).toFixed(2) : '—'
  const avgCostDC = dcCharges.length ? (dcCharges.reduce((s,c)=>s+(c.totalCost||0),0)/dcCharges.length).toFixed(2) : '—'
  const maxSession = filtered.length ? Math.max(...filtered.map(c=>c.kwh)).toFixed(1) : '—'
  const avgPrice   = stats.avgPrice > 0 ? stats.avgPrice.toFixed(3) : '—'
  const lastCharge  = activeVehicle
    ? sorted.find(c => c.vehicleId === activeVehicle)
    : sorted[0]
  const streak = lastCharge ? Math.floor((now-new Date(lastCharge.date+'T00:00:00'))/86400000) : null

  // Last AC (home) and DC (external) charge days
  const filteredForStreak = activeVehicle ? sorted.filter(c=>c.vehicleId===activeVehicle) : sorted
  const lastAC = filteredForStreak.find(c => c.locationId === 'home')
  const lastDC = filteredForStreak.find(c => c.locationId !== 'home')
  const daysAC = lastAC ? Math.floor((now-new Date(lastAC.date+'T00:00:00'))/86400000) : null
  const daysDC = lastDC ? Math.floor((now-new Date(lastDC.date+'T00:00:00'))/86400000) : null
  // Savings from DB (computed at save time with user's fuel price)
  const savings     = filtered.reduce((s,c) => s + (c.fuelSavings||0), 0)
  const solarSavings = filtered.reduce((s,c) => s + (c.solarSavings||0), 0)
  const homeCharges  = filtered.filter(c => c.locationId === 'home')
  const solarCharges = homeCharges.filter(c => (c.solarSavings||0) > 0.05)
  const solarPct     = homeCharges.length > 0 ? Math.round(solarCharges.length / homeCharges.length * 100) : null
  const solarKwh = solarSavings / 0.14

  const periodLabel  = activePeriod ? PERIODS.find(p=>p.id===activePeriod)?.label : 'Tout'
  const vehicleLabel = activeVehicle ? VEHICLES[activeVehicle]?.name : 'Tous véhicules'

  const chartLabel = {
    null: 'Par année', all:'Par année',
    year:'Par mois', '12m':'Par mois',
    month:'Par jour', '30d':'Par jour',
  }[activePeriod] || 'Par année'

  function togglePeriod(id)  { setActivePeriod(p  => p===id ? null : id) }
  function toggleVehicle(id) { setActiveVehicle(v => v===id ? null : id) }

  // Avg power (kW) from sessions with duration
  const avgPower = useMemo(() => {
    const withDur = filtered.filter(c => c.durationMin > 0)
    if (!withDur.length) return null
    const totalKwhD = withDur.reduce((s,c) => s+c.kwh, 0)
    const totalHours = withDur.reduce((s,c) => s+c.durationMin/60, 0)
    return totalHours > 0 ? (totalKwhD/totalHours).toFixed(1) : null
  }, [filtered])

  const avgPowerAC = useMemo(() => {
    const withDur = acCharges.filter(c => c.durationMin > 0)
    if (!withDur.length) return null
    const totalKwhD = withDur.reduce((s,c) => s+c.kwh, 0)
    const totalHours = withDur.reduce((s,c) => s+c.durationMin/60, 0)
    return totalHours > 0 ? (totalKwhD/totalHours).toFixed(1) : null
  }, [acCharges])

  const avgPowerDC = useMemo(() => {
    const withDur = dcCharges.filter(c => c.durationMin > 0)
    if (!withDur.length) return null
    const totalKwhD = withDur.reduce((s,c) => s+c.kwh, 0)
    const totalHours = withDur.reduce((s,c) => s+c.durationMin/60, 0)
    return totalHours > 0 ? (totalKwhD/totalHours).toFixed(1) : null
  }, [dcCharges])

  const avgPriceAC = acCharges.reduce((s,c)=>s+(c.kwh||0),0) > 0
    ? (acCharges.reduce((s,c)=>s+(c.totalCost||0),0) / acCharges.reduce((s,c)=>s+(c.kwh||0),0)).toFixed(3) : '—'
  const avgPriceDC = dcCharges.reduce((s,c)=>s+(c.kwh||0),0) > 0
    ? (dcCharges.reduce((s,c)=>s+(c.totalCost||0),0) / dcCharges.reduce((s,c)=>s+(c.kwh||0),0)).toFixed(3) : '—'

  // Top provider
  const topProvider = useMemo(() => {
    const map = {}
    filtered.filter(c=>c.locationId!=='home'&&c.provider).forEach(c => {
      map[c.provider] = (map[c.provider]||0) + 1
    })
    const top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0]
    return top ? `${top[0]} (${top[1]})` : '—'
  }, [filtered])

  // Most expensive session
  const maxCost = filtered.length ? Math.max(...filtered.map(c=>c.totalCost||0)).toFixed(2) : '—'
  const maxCostAC = acCharges.length ? Math.max(...acCharges.map(c=>c.totalCost||0)).toFixed(2) : '—'
  const maxCostDC = dcCharges.length ? Math.max(...dcCharges.map(c=>c.totalCost||0)).toFixed(2) : '—'

  // Monthly average per vehicle, over full history (not period-filtered)
  const monthlyAvg = useMemo(() => getMonthlyAvgByVehicle(charges), [charges])

  const kpis = [
    {
      // Combined home/ext bar
      type:'bar',
      homeKwh: stats.homeKwh, extKwh: stats.extKwh,
      homePct, extPct,
      label:'Maison / Externe',
    },
    { type:'acdc', valAC:avgSessionAC, valDC:avgSessionDC, suffix:'kWh', label:'kWh/session moy.', color:'var(--mg4)' },
    { type:'acdc', valAC:avgCostAC, valDC:avgCostDC, suffix:'€', label:'Coût/session moy.', color:'var(--xpeng)' },
    { type:'streak', daysAC, daysDC, label:'Dernière charge' },
    { type:'savings', savings, solarSavings, solarKwh, label:'Économies' },
    { type:'acdc', valAC:avgPriceAC, valDC:avgPriceDC, suffix:'€/kWh', label:'€/kWh moyen', color:'var(--text)' },
    { type:'acdc', valAC: avgPowerAC||'—', valDC: avgPowerDC||'—', suffix:'kW', label:'Puissance moy.', color:'var(--accent)' },
    { type:'acdc', valAC:maxCostAC, valDC:maxCostDC, suffix:'€', label:'Session la + chère', color:'var(--amber)' },
    { val: topProvider,     label:'Top fournisseur',       color:'var(--accent)', small:true },
  ]

  return (
    <div className="page fade-up" style={{ paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Tableau de bord</div>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:1, textTransform:'capitalize' }}>{dateStr}</div>
      </div>

      {/* Alertes dynamiques depuis le serveur */}
      {alerts.length > 0 && (
        <div onClick={()=>onNavigateAlert && onNavigateAlert(alerts)} style={{ margin:'10px 16px 0', padding:'12px 14px', background:'rgba(245,158,11,0.08)', border:'1.5px solid rgba(245,158,11,0.35)', borderRadius:'var(--r-sm)', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--amber)' }}>
              {alerts.reduce((s,a)=>s+a.count,0)} session{alerts.reduce((s,a)=>s+a.count,0)>1?'s':''} à compléter
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{alerts.map(a=>a.label).join(' · ')}</div>
          </div>
          <span style={{ color:'var(--amber)', fontSize:16 }}>›</span>
        </div>
      )}

      {/* Period banners — 2x2 grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'14px 16px 0' }}>
        {periodStats.map(p => {
          const active = activePeriod === p.id
          return (
            <div key={p.id} onClick={()=>togglePeriod(p.id)} style={{
              cursor:'pointer',
              background: active ? `linear-gradient(135deg,${p.accent}30,${p.accent}18)` : `linear-gradient(135deg,${p.accent}12,${p.accent}06)`,
              border: active ? `2px solid ${p.accent}` : `1px solid ${p.accent}28`,
              borderRadius:'var(--r)', padding:'13px 14px',
              boxShadow: active ? `0 0 18px ${p.accent}35` : 'none',
              transition:'all 0.15s',
            }}>
              <div style={{ fontSize:10, color: active?p.accent:'var(--muted)', marginBottom:5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{p.label}</div>
              <div className="mono" style={{ fontSize:22, fontWeight:700, lineHeight:1 }}>
                {p.stats.totalKwh.toFixed(0)}<span style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}> kWh</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, alignItems:'center' }}>
                <span style={{ fontSize:10, color:'var(--muted)' }}>{p.stats.count} sess.</span>
                <span className="mono" style={{ fontSize:13, fontWeight:700, color:p.accent }}>{p.stats.totalCost.toFixed(0)} €</span>
              </div>
              {p.stats.avgPrice > 0 && <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{p.stats.avgPrice.toFixed(3)} €/kWh</div>}
            </div>
          )
        })}
      </div>

      {/* Filter context */}
      {(activePeriod || activeVehicle) && (
        <div style={{ margin:'10px 16px 0', padding:'7px 12px', background:'rgba(79,142,247,0.08)', border:'1px solid rgba(79,142,247,0.2)', borderRadius:'var(--r-sm)', fontSize:12, color:'var(--accent)', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
          <span>🔍</span>
          <span>{[activePeriod && periodLabel, activeVehicle && vehicleLabel].filter(Boolean).join(' · ')}</span>
          <button onClick={()=>{setActivePeriod(null);setActiveVehicle(null)}} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, padding:'0 2px' }}>✕</button>
        </div>
      )}

      {/* Vehicle cards — always show both, dim non-selected */}
      <div style={{ margin:'10px 16px 0' }}>
        <div className="section-label">{`Véhicules — ${periodLabel}`}</div>
        <div style={{ display:'flex', gap:8 }}>
          <VehicleCard v={VEHICLES.mg4}   charges={periodFiltered} allStats={statsAll} selected={activeVehicle} onClick={()=>toggleVehicle('mg4')} />
          <VehicleCard v={VEHICLES.xpeng} charges={periodFiltered} allStats={statsAll} selected={activeVehicle} onClick={()=>toggleVehicle('xpeng')} />
        </div>
      </div>

      {/* Monthly average per vehicle */}
      {(monthlyAvg.mg4.months > 0 || monthlyAvg.xpeng.months > 0) && (
        <div style={{ margin:'10px 16px 0' }}>
          <div className="section-label">Moyenne mensuelle par véhicule</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {Object.entries(VEHICLES).map(([vid, v]) => {
              const m = monthlyAvg[vid]
              if (!m || m.months === 0) return (
                <div key={vid} className="card" style={{ padding:'12px 14px', opacity:0.5 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:14 }}>{v.emoji}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:v.color }}>{v.name}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>Aucune donnée</div>
                </div>
              )
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

      {/* KPIs grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:7, margin:'10px 16px 0' }}>
        {kpis.map((k,i) => (
          <div key={k.label} className="card" style={{ padding:'10px 10px', gridColumn: (k.type==='bar' || k.type==='acdc') ? 'span 2' : undefined }}>
            {k.type === 'savings' ? (
              <>
                <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
                {k.savings !== 0 && <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:2 }}>
                  <span style={{ fontSize:9 }}>🚗</span>
                  <span className="mono" style={{ fontSize:12, fontWeight:700, color: k.savings >= 0 ? 'var(--green)' : 'var(--red)' }}>{k.savings >= 0 ? '+' : ''}{k.savings.toFixed(0)}€</span>
                </div>}
                {k.solarSavings > 0.05 && <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <span style={{ fontSize:9 }}>☀️</span>
                  <span className="mono" style={{ fontSize:12, fontWeight:700, color:'var(--amber)' }}>{k.solarSavings.toFixed(1)}€{k.solarKwh > 0.5 ? ` · ${k.solarKwh.toFixed(0)}kWh` : ''}</span>
                </div>}
                {k.savings === 0 && k.solarSavings <= 0.05 && <div className="mono" style={{ fontSize:14, fontWeight:700, color:'var(--muted)' }}>—</div>}
              </>
            ) : k.type === 'acdc' ? (
              <>
                <div style={{ fontSize:9, color:'var(--muted)', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="mono" style={{ fontSize:15, fontWeight:700, color:k.color, whiteSpace:'nowrap' }}>{k.valAC}{k.valAC!=='—'?` ${k.suffix}`:''}</div>
                    <div style={{ fontSize:8, color:'var(--green)', marginTop:2 }}>🏠 AC</div>
                  </div>
                  <div style={{ width:1, background:'var(--border)', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="mono" style={{ fontSize:15, fontWeight:700, color:k.color, whiteSpace:'nowrap' }}>{k.valDC}{k.valDC!=='—'?` ${k.suffix}`:''}</div>
                    <div style={{ fontSize:8, color:'var(--amber)', marginTop:2 }}>⚡ DC</div>
                  </div>
                </div>
              </>
            ) : k.type === 'streak' ? (
              <>
                <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <div style={{ flex:1 }}>
                    <div className="mono" style={{ fontSize:13, fontWeight:700, color: k.daysAC===0?'var(--green)':k.daysAC>7?'var(--red)':'var(--text)' }}>{k.daysAC!==null?`${k.daysAC}j`:'—'}</div>
                    <div style={{ fontSize:8, color:'var(--green)', marginTop:2 }}>🏠 AC</div>
                  </div>
                  <div style={{ width:1, background:'var(--border)' }} />
                  <div style={{ flex:1 }}>
                    <div className="mono" style={{ fontSize:13, fontWeight:700, color: k.daysDC===0?'var(--green)':k.daysDC>7?'var(--red)':'var(--text)' }}>{k.daysDC!==null?`${k.daysDC}j`:'—'}</div>
                    <div style={{ fontSize:8, color:'var(--amber)', marginTop:2 }}>📍 DC</div>
                  </div>
                </div>
              </>
            ) : k.type === 'bar' ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>{k.homePct}%</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--amber)' }}>{k.extPct}%</span>
                </div>
                <div style={{ display:'flex', gap:2, height:6, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ flex:k.homeKwh||0.001, background:'var(--green)', opacity:.85 }} />
                  <div style={{ flex:k.extKwh||0.001, background:'var(--amber)', opacity:.85 }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                  <span style={{ fontSize:8.5, color:'var(--green)' }}>🏠 AC · {k.homeKwh.toFixed(0)} kWh</span>
                  <span style={{ fontSize:8, color:'var(--muted)' }}>{k.label}</span>
                  <span style={{ fontSize:8.5, color:'var(--amber)' }}>{k.extKwh.toFixed(0)} kWh · DC ⚡</span>
                </div>
              </>
            ) : (
              <>
                <div className={k.mono?'mono':''} style={{ fontSize:k.small?11:15, fontWeight:700, color:k.color, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.val}</div>
                <div style={{ fontSize:8.5, color:'var(--muted)', marginTop:4, lineHeight:1.3 }}>{k.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Adaptive chart */}
      {chartData.length > 0 && (
        <div style={{ margin:'14px 16px 0' }}>
          <div className="card" style={{ padding:'14px 16px' }}>
            <div className="section-label">{chartLabel} — {periodLabel} · {vehicleLabel}</div>
            <ResponsiveContainer width="100%" height={100}>
              {isDailyChart ? (
                <BarChart data={chartData} barSize={chartData.length > 20 ? 5 : 9} barGap={1}>
                  <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:8 }} axisLine={false} tickLine={false} interval={0} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="mg4"   fill="var(--mg4)"   radius={[0,0,0,0]} stackId="a" />
                  <Bar dataKey="xpeng" fill="var(--xpeng)" radius={[2,2,0,0]} stackId="a" />
                </BarChart>
              ) : (
                <BarChart data={chartData} barSize={20} barGap={3}>
                  <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="mg4"   fill="var(--mg4)"   radius={[0,0,0,0]} stackId="a" />
                  <Bar dataKey="xpeng" fill="var(--xpeng)" radius={[3,3,0,0]} stackId="a" />
                </BarChart>
              )}
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:14, marginTop:4, fontSize:10, fontWeight:500 }}>
              {[{c:'var(--mg4)',l:'MG4'},{c:'var(--xpeng)',l:'Xpeng G6'}].map(i=>(
                <div key={i.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:i.c }} />{i.l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Provider chart */}
      {filtered.filter(c=>c.locationId!=='home').length > 0 && (
        <div style={{ margin:'10px 16px 0' }}>
          <ProviderChart charges={filtered} />
        </div>
      )}

      {/* Recent sessions */}
      <div style={{ margin:'14px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div className="section-label" style={{ marginBottom:0 }}>Dernières sessions</div>
          {recentFiltered.length >= 8 && (
            <button onClick={()=>onNavigate('history')} style={{ fontSize:12, color:'var(--accent)', fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>Voir tout →</button>
          )}
        </div>
        <div className="card" style={{ padding:'0 16px' }}>
          {recentFiltered.length === 0 ? (
            <div style={{ padding:'28px 0', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              Aucune session pour ce filtre.
              {!activePeriod && !activeVehicle && (
                <div style={{ marginTop:10 }}>
                  <button onClick={()=>onNavigate('add')} style={{ color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontWeight:600, fontSize:13 }}>Ajouter la première →</button>
                </div>
              )}
            </div>
          ) : recentFiltered.map((c, idx) => {
            const v = VEHICLES[c.vehicleId] || { color:'var(--muted)', name:'?', emoji:'🚗' }
            const isHome = c.locationId === 'home'
            const logoName = isHome ? (c.provider||'v2c') : (c.provider||'')
            return (
              <div key={c.id} onClick={()=>onNavigate('edit', c)}
                style={{ display:'flex', cursor:'pointer', borderBottom: idx < recentFiltered.length-1 ? '1px solid var(--border)' : 'none', marginLeft:-16, marginRight:-16 }}>
                <div style={{ width:3, background:v.color, flexShrink:0 }} />
                <div style={{ width:48, display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 6px', flexShrink:0 }}>
                  <div style={{ width:36, height:36, borderRadius:9, overflow:'hidden', background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <OperatorLogo name={logoName} size={36} style={{ width:36, height:36, borderRadius:9, objectFit:'cover' }} />
                  </div>
                </div>
                <div style={{ flex:1, minWidth:0, padding:'10px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:v.color }}>{v.name}</span>
                    {c.provider && <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:20,
                      background: isHome?'rgba(34,197,94,0.1)':'rgba(79,142,247,0.1)',
                      color: isHome?'var(--green)':'var(--accent)',
                      border:`1px solid ${isHome?'rgba(34,197,94,0.2)':'rgba(79,142,247,0.2)'}` }}>{c.provider}</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
                    {formatDate(c.date)}{c.durationMin ? ` · ${formatDuration(c.durationMin)}` : ''}
                  </div>
                  {c.card ? (
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, display:'flex', alignItems:'center', gap:5 }}>
                      <CardLogo name={c.card} size={11} />
                      <span>{c.card}</span>
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign:'right', flexShrink:0, padding:'10px 16px 10px 8px', display:'flex', flexDirection:'column', justifyContent:'center', gap:2 }}>
                  <div className="mono" style={{ fontSize:14, fontWeight:700 }}>{c.kwh} kWh</div>
                  <span className="mono" style={{ fontSize:12, fontWeight:700, color: isHome?'var(--green)':'var(--amber)' }}>{formatCost(c.totalCost)}</span>
                  <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'flex-end', marginTop:2 }}>
                    {c.fuelSavings != null && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:10, background: c.fuelSavings >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: c.fuelSavings >= 0 ? 'var(--green)' : 'var(--red)' }}>🚗 {c.fuelSavings >= 0 ? '+' : ''}{c.fuelSavings.toFixed(2)}€</span>}
                    {c.solarSavings >= 0.01 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:10, background:'rgba(251,191,36,0.12)', color:'var(--amber)' }}>☀️ {c.solarSavings.toFixed(2)}€</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
