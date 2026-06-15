import React, { useMemo, useRef } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from 'recharts'
import { computeStats, filterByPeriod, getDailyData, getProviderStats, formatCost, formatDate, formatDuration, VEHICLES } from '../utils.js'
import OperatorLogo from '../components/OperatorLogo.jsx'
import AppLogo from '../components/AppLogo.jsx'

const PROVIDER_COLORS = ['#4f8ef7','#7c5cfc','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => p.value > 0 && (
        <div key={p.dataKey} style={{ color:p.fill, fontWeight:600 }}>
          {p.dataKey==='mg4'?'MG4':'Xpeng G6'}: {p.value.toFixed(1)} kWh
        </div>
      ))}
    </div>
  )
}

// Horizontal scrollable period banner
function PeriodBanner({ periods }) {
  const scrollRef = useRef(null)
  return (
    <div ref={scrollRef} style={{ display:'flex', gap:10, overflowX:'auto', scrollbarWidth:'none', padding:'0 16px' }}>
      {periods.map(({ label, stats, accent }) => (
        <div key={label} style={{ flexShrink:0, minWidth:160, background:`linear-gradient(135deg,${accent}22,${accent}10)`, border:`1px solid ${accent}40`, borderRadius:'var(--r)', padding:'14px 16px' }}>
          <div style={{ fontSize:10, color:'var(--muted)', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
          <div className="mono" style={{ fontSize:26, fontWeight:700, lineHeight:1, color:'var(--text)' }}>
            {stats.totalKwh.toFixed(0)}<span style={{ fontSize:13, color:'var(--muted)', fontWeight:400 }}> kWh</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
            <span style={{ fontSize:11, color:'var(--muted)' }}>{stats.count} session{stats.count!==1?'s':''}</span>
            <span className="mono" style={{ fontSize:13, fontWeight:700, color:accent }}>{stats.totalCost.toFixed(0)} €</span>
          </div>
          {stats.avgPrice > 0 && (
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{stats.avgPrice.toFixed(3)} €/kWh moy.</div>
          )}
        </div>
      ))}
    </div>
  )
}

// Vehicle card
function VehicleCard({ v, stats, total }) {
  const pct = total > 0 ? Math.round(stats.totalKwh / total * 100) : 0
  return (
    <div style={{ flex:1, background:'var(--surface)', border:`1.5px solid ${v.color}33`, borderRadius:'var(--r-sm)', padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ fontSize:20 }}>{v.emoji}</span>
        <span style={{ fontSize:13, fontWeight:700, color:v.color }}>{v.name}</span>
        <span style={{ marginLeft:'auto', fontSize:11, fontWeight:600, color:v.color, background:`${v.color}18`, padding:'2px 7px', borderRadius:20 }}>{pct}%</span>
      </div>
      <div className="mono" style={{ fontSize:22, fontWeight:700 }}>{stats.totalKwh.toFixed(0)}<span style={{ fontSize:12, color:'var(--muted)', fontWeight:400 }}> kWh</span></div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{stats.count} sessions</span>
        <span className="mono" style={{ fontSize:11, fontWeight:600, color:'var(--green)' }}>{stats.totalCost.toFixed(2)} €</span>
      </div>
      {/* Mini bar home/ext */}
      {stats.totalKwh > 0 && (
        <div style={{ marginTop:8, display:'flex', gap:4, alignItems:'center' }}>
          <div style={{ flex:stats.homeKwh||0.001, height:4, borderRadius:2, background:'var(--green)', opacity:.8 }} />
          <div style={{ flex:stats.extKwh||0.001, height:4, borderRadius:2, background:'var(--amber)', opacity:.8 }} />
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginTop:4, fontSize:10, color:'var(--muted)' }}>
        <span>🏠 {stats.homeKwh.toFixed(0)} kWh</span>
        <span>📍 {stats.extKwh.toFixed(0)} kWh</span>
      </div>
    </div>
  )
}

// Provider donut
function ProviderDonut({ charges }) {
  const data = useMemo(() => getProviderStats(charges).slice(0,6), [charges])
  if (data.length === 0) return null
  const total = data.reduce((s,d)=>s+d.kwh,0)
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div className="section-label">Répartition fournisseurs (externe)</div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <PieChart width={110} height={110}>
          <Pie data={data} dataKey="kwh" cx={55} cy={55} innerRadius={30} outerRadius={50} paddingAngle={2} strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />)}
          </Pie>
        </PieChart>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
          {data.map((d, i) => (
            <div key={d.name} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <OperatorLogo name={d.name} size={16} />
              <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{d.name}</span>
              <span className="mono" style={{ fontSize:10, color:PROVIDER_COLORS[i%PROVIDER_COLORS.length], fontWeight:600 }}>{Math.round(d.kwh/total*100)}%</span>
              <span className="mono" style={{ fontSize:10, color:'var(--muted)' }}>{d.kwh.toFixed(0)} kWh</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ charges, onNavigate }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })

  const month30 = useMemo(() => filterByPeriod(charges, '30d'),   [charges])
  const monthCal= useMemo(() => filterByPeriod(charges, 'month'), [charges])
  const year    = useMemo(() => filterByPeriod(charges, 'year'),  [charges])

  const periods = [
    { label:'30 derniers jours', stats: computeStats(month30),  accent:'#4f8ef7' },
    { label:'Ce mois-ci',        stats: computeStats(monthCal), accent:'#7c5cfc' },
    { label:'Cette année',       stats: computeStats(year),     accent:'#22c55e' },
  ]

  const statsMg4   = useMemo(() => computeStats(monthCal, 'mg4'),   [monthCal])
  const statsXpeng = useMemo(() => computeStats(monthCal, 'xpeng'), [monthCal])
  const statsAll   = useMemo(() => computeStats(monthCal),          [monthCal])
  const daily      = useMemo(() => getDailyData(charges, 30),        [charges])

  const sorted = useMemo(() => [...charges].sort((a,b)=>b.date.localeCompare(a.date)), [charges])
  const recent = sorted.slice(0, 8)

  // Extra KPIs
  const extPct     = statsAll.totalKwh > 0 ? Math.round(statsAll.extKwh/statsAll.totalKwh*100) : 0
  const avgSession = statsAll.count > 0 ? (statsAll.totalKwh/statsAll.count).toFixed(1) : '—'
  const streak = useMemo(() => {
    // Days since last charge
    if (!sorted.length) return null
    const last = new Date(sorted[0].date+'T00:00:00')
    const diff = Math.floor((new Date()-last)/86400000)
    return diff
  }, [sorted])

  return (
    <div className="page fade-up" style={{ paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:'16px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>Tableau de bord</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:1, textTransform:'capitalize' }}>{dateStr}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <AppLogo size={32} />
          <button onClick={()=>onNavigate('settings')} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:20, padding:4 }}>⚙️</button>
          <button onClick={()=>onNavigate('add')} style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', borderRadius:12, padding:'8px 14px', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px var(--accent-glow)' }}>＋</button>
        </div>
      </div>

      {/* Period banners — scrollable */}
      <div style={{ marginTop:14 }}>
        <PeriodBanner periods={periods} />
      </div>

      {/* Vehicle cards (ce mois) */}
      <div style={{ margin:'10px 16px 0' }}>
        <div className="section-label">Véhicules — ce mois</div>
        <div style={{ display:'flex', gap:8 }}>
          <VehicleCard v={VEHICLES.mg4}   stats={statsMg4}   total={statsAll.totalKwh} />
          <VehicleCard v={VEHICLES.xpeng} stats={statsXpeng} total={statsAll.totalKwh} />
        </div>
      </div>

      {/* Extra KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, margin:'10px 16px 0' }}>
        {[
          { val: `${extPct}%`,     label:'Recharge externe', color:'var(--amber)' },
          { val: `${avgSession}`,  label:'kWh/session moy.',  color:'var(--mg4)', mono:true },
          { val: streak !== null ? `${streak}j` : '—', label:'Depuis dernière charge', color: streak===0?'var(--green)':streak>7?'var(--red)':'var(--muted)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding:'11px 12px' }}>
            <div className={k.mono?'mono':''} style={{ fontSize:18, fontWeight:700, color:k.color, lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:9, color:'var(--muted)', marginTop:4, lineHeight:1.3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 30j daily chart */}
      {charges.length > 0 && (
        <div style={{ margin:'14px 16px 0' }}>
          <div className="card" style={{ padding:'14px 16px' }}>
            <div className="section-label">30 derniers jours</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={daily} barSize={5} barGap={1}>
                <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:8 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="mg4"   fill="var(--mg4)"   radius={[2,2,0,0]} stackId="a" />
                <Bar dataKey="xpeng" fill="var(--xpeng)" radius={[2,2,0,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:14, marginTop:4, fontSize:10, fontWeight:500 }}>
              {[{c:'var(--mg4)',l:'MG4'},{c:'var(--xpeng)',l:'Xpeng G6'}].map(i => (
                <div key={i.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:i.c }} />{i.l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Provider donut */}
      {charges.filter(c=>c.locationId!=='home').length > 0 && (
        <div style={{ margin:'10px 16px 0' }}>
          <ProviderDonut charges={charges} />
        </div>
      )}

      {/* Recent sessions */}
      <div style={{ margin:'14px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div className="section-label" style={{ marginBottom:0 }}>Dernières sessions</div>
          {charges.length > 8 && (
            <button onClick={()=>onNavigate('history')} style={{ fontSize:12, color:'var(--accent)', fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>Voir tout →</button>
          )}
        </div>
        <div className="card" style={{ padding:'0 16px' }}>
          {recent.length === 0 ? (
            <div style={{ padding:'28px 0', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              Aucune session encore.
              <div style={{ marginTop:10 }}>
                <button onClick={()=>onNavigate('add')} style={{ color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontWeight:600, fontSize:13 }}>Ajouter la première →</button>
              </div>
            </div>
          ) : recent.map((c, idx) => {
            const v = VEHICLES[c.vehicleId]
            const isHome = c.locationId === 'home'
            const logoName = isHome ? (c.provider||'v2c') : (c.provider||'')
            return (
              <div key={c.id} onClick={()=>onNavigate('edit', c)}
                style={{ display:'flex', cursor:'pointer', borderBottom: idx < recent.length-1 ? '1px solid var(--border)' : 'none', marginLeft:-16, marginRight:-16 }}>
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
                </div>
                <div style={{ textAlign:'right', flexShrink:0, padding:'10px 16px 10px 8px', display:'flex', flexDirection:'column', justifyContent:'center', gap:2 }}>
                  <div className="mono" style={{ fontSize:14, fontWeight:700 }}>{c.kwh} kWh</div>
                  <div className="mono" style={{ fontSize:11, fontWeight:600, color: isHome?'var(--green)':'var(--amber)' }}>{formatCost(c.totalCost)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
