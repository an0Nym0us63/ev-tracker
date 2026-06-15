import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import { computeStats, filterByPeriod, getChartData, getProviderStats, VEHICLES, formatCost } from '../utils.js'
import OperatorLogo from '../components/OperatorLogo.jsx'

const PROVIDER_COLORS = ['#4f8ef7','#7c5cfc','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16']

const PERIODS = [
  { id:'month', label:'Ce mois' },
  { id:'year',  label:'Cette année' },
  { id:'30d',   label:'30 jours' },
  { id:'12m',   label:'12 mois' },
  { id:'all',   label:'Tout' },
]

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  const total = payload.reduce((s,p)=>s+(p.value||0),0)
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => p.value > 0 && <div key={p.dataKey} style={{ color:p.fill||p.stroke||'var(--text)', fontWeight:600 }}>{p.name}: {p.value.toFixed(1)} {p.unit||'kWh'}</div>)}
      {payload.length > 1 && total > 0 && <div style={{ color:'var(--text)', fontWeight:700, marginTop:3, borderTop:'1px solid var(--border)', paddingTop:3 }}>Total: {total.toFixed(1)} kWh</div>}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

export default function Stats({ charges }) {
  const [period,  setPeriod]  = useState('month')
  const [vehicle, setVehicle] = useState('all')

  const periodFiltered  = useMemo(() => filterByPeriod(charges, period), [charges, period])
  const filtered = useMemo(() => vehicle === 'all' ? periodFiltered : periodFiltered.filter(c=>c.vehicleId===vehicle), [periodFiltered, vehicle])

  const stats      = useMemo(() => computeStats(filtered),          [filtered])
  const statsMg4   = useMemo(() => computeStats(periodFiltered,'mg4'),   [periodFiltered])
  const statsXpeng = useMemo(() => computeStats(periodFiltered,'xpeng'), [periodFiltered])
  const statsAll   = useMemo(() => computeStats(periodFiltered),         [periodFiltered])

  const chartData  = useMemo(() => getChartData(filtered, period), [filtered, period])
  const providers  = useMemo(() => getProviderStats(filtered), [filtered])
  const isDailyChart = period === 'month' || period === '30d'

  // Extra stats
  const savings    = filtered.reduce((s,c)=>s+(c.fuelSavings||0),0)
  const avgSession = stats.count > 0 ? (stats.totalKwh/stats.count).toFixed(1) : '—'
  const avgCost    = stats.count > 0 ? (stats.totalCost/stats.count).toFixed(2) : '—'
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

  // DC speed in kWh/min per vehicle
  const dcSpeedPerVehicle = useMemo(() => {
    const result = {}
    for (const vid of ['mg4', 'xpeng']) {
      const sessions = filtered.filter(c => c.vehicleId===vid && c.locationId!=='home' && c.durationMin>0 && c.kwh>0)
      if (!sessions.length) { result[vid] = null; continue }
      const totalKwh = sessions.reduce((s,c)=>s+c.kwh,0)
      const totalMin = sessions.reduce((s,c)=>s+c.durationMin,0)
      result[vid] = (totalKwh / totalMin).toFixed(3)
    }
    return result
  }, [filtered])
  const maxSession = filtered.length ? Math.max(...filtered.map(c=>c.kwh)).toFixed(1) : '—'
  const maxCost    = filtered.length ? Math.max(...filtered.map(c=>c.totalCost||0)).toFixed(2) : '—'
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
    // Cumulative cost — rebuild from charges
    let cum = 0
    return d.map(row => {
      const dayCharges = filtered.filter(c => c.date === row.date || !row.date)
      const dc = filtered.filter(c => {
        if (row.date) return c.date === row.date
        return true
      })
      const cost = dc.reduce((s,c)=>s+(c.totalCost||0),0)
      cum += cost
      return { ...row, cost: parseFloat(cost.toFixed(2)), cumCost: parseFloat(cum.toFixed(2)) }
    })
  }, [filtered, period])

  const chipStyle = (active, color='var(--accent)') => ({
    padding:'5px 13px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0,
    border:`1.5px solid ${active?color:'var(--border)'}`,
    background:active?`rgba(79,142,247,0.1)`:'var(--surface)',
    color:active?color:'var(--muted)', cursor:'pointer',
  })

  return (
    <div className="page fade-up" style={{ paddingBottom:100 }}>
      <div style={{ padding:'16px 20px 8px' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Statistiques</div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, padding:'0 16px 0', overflowX:'auto', scrollbarWidth:'none' }}>
        {PERIODS.map(p => <button key={p.id} onClick={()=>setPeriod(p.id)} style={chipStyle(period===p.id)}>{p.label}</button>)}
        <div style={{ width:1, background:'var(--border)', margin:'4px 2px', flexShrink:0 }} />
        {[{id:'all',label:'Tous'},{id:'mg4',label:'MG4'},{id:'xpeng',label:'Xpeng'}].map(v =>
          <button key={v.id} onClick={()=>setVehicle(v.id)} style={chipStyle(vehicle===v.id, v.id==='mg4'?'var(--mg4)':v.id==='xpeng'?'var(--xpeng)':'var(--accent)')}>{v.label}</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Aucune session sur cette période.</div>
      ) : (<>

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
        {savings > 0 && (
          <div style={{ margin:'8px 16px 0', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'var(--r-sm)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>Économies vs thermique</div>
              <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>MG4 (206, 6L/100) · Xpeng (Cruze diesel, 7.5L/100)</div>
            </div>
            <div className="mono" style={{ fontSize:22, fontWeight:700, color:'var(--green)' }}>+{savings.toFixed(0)} €</div>
          </div>
        )}

        {/* Grid KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:7, margin:'8px 16px 0' }}>
          {[
            { val:`${avgSession}`, label:'kWh/session', color:'var(--mg4)', mono:true },
            { val:`${avgCost} €`,  label:'€/session',   color:'var(--xpeng)', mono:true },
            { val:`${maxSession}`, label:'Max kWh',      color:'var(--accent)', mono:true },
            { val:`${maxCost} €`,  label:'Session chère',color:'var(--amber)', mono:true },
            { val: avgPwrHome ? `${avgPwrHome} kW` : '—', label:'Moy. AC 🏠', color:'var(--green)', mono:true },
            { val: avgPwrDC   ? `${avgPwrDC} kW`   : '—', label:'Moy. DC 📍', color:'var(--amber)', mono:true },
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
                  <Bar dataKey="cost" name="Coût" unit=" €" fill="var(--green)" radius={[3,3,0,0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Provider bars */}
        {providers.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <SectionLabel>Fournisseurs externes</SectionLabel>
            <div className="card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:9 }}>
              {providers.slice(0,8).map((d,i) => {
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

      </>)}
    </div>
  )
}
