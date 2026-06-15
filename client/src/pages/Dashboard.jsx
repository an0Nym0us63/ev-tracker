import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from 'recharts'
import { computeStats, filterByPeriod, getDailyData, getProviderStats, formatCost, formatDate, formatDuration, VEHICLES } from '../utils.js'
import OperatorLogo from '../components/OperatorLogo.jsx'
import AppLogo from '../components/AppLogo.jsx'

const PROVIDER_COLORS = ['#4f8ef7','#7c5cfc','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16']

const PERIODS = [
  { id:'month',  label:'Ce mois',      accent:'#4f8ef7' },
  { id:'year',   label:'Cette année',  accent:'#7c5cfc' },
  { id:'30d',    label:'30 jours',     accent:'#22c55e' },
  { id:'12m',    label:'12 mois',      accent:'#f59e0b' },
]

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

function VehicleCard({ v, stats, total, selected, onClick }) {
  const pct = total > 0 ? Math.round(stats.totalKwh / total * 100) : 0
  const isSelected = selected === v.id
  return (
    <div onClick={onClick} style={{
      flex:1, background:'var(--surface)', borderRadius:'var(--r-sm)', padding:'12px 14px', cursor:'pointer',
      border: isSelected ? `2px solid ${v.color}` : '1.5px solid var(--border)',
      boxShadow: isSelected ? `0 0 16px ${v.color}44` : 'none',
      transition:'all 0.15s',
    }}>
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
      {stats.totalKwh > 0 && (
        <>
          <div style={{ marginTop:8, display:'flex', gap:4 }}>
            <div style={{ flex:stats.homeKwh||0.001, height:4, borderRadius:2, background:'var(--green)', opacity:.8 }} />
            <div style={{ flex:stats.extKwh||0.001, height:4, borderRadius:2, background:'var(--amber)', opacity:.8 }} />
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4, fontSize:10, color:'var(--muted)' }}>
            <span>🏠 {stats.homeKwh.toFixed(0)} kWh</span>
            <span>📍 {stats.extKwh.toFixed(0)} kWh</span>
          </div>
        </>
      )}
    </div>
  )
}

function ProviderDonut({ charges }) {
  const data = useMemo(() => getProviderStats(charges).slice(0,6), [charges])
  if (data.length === 0) return null
  const total = data.reduce((s,d)=>s+d.kwh,0)
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div className="section-label">Répartition fournisseurs</div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <PieChart width={100} height={100}>
          <Pie data={data} dataKey="kwh" cx={50} cy={50} innerRadius={28} outerRadius={46} paddingAngle={2} strokeWidth={0}>
            {data.map((_,i) => <Cell key={i} fill={PROVIDER_COLORS[i%PROVIDER_COLORS.length]} />)}
          </Pie>
        </PieChart>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
          {data.map((d,i) => (
            <div key={d.name} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <OperatorLogo name={d.name} size={14} />
              <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
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
  const [activePeriod,  setActivePeriod]  = useState(null) // null = tout
  const [activeVehicle, setActiveVehicle] = useState(null) // null = tous

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })

  // Stats for each period banner (always unfiltered by vehicle for the banner itself)
  const periodStats = useMemo(() => {
    return PERIODS.map(p => ({
      ...p,
      stats: computeStats(filterByPeriod(charges, p.id)),
    }))
  }, [charges])

  // Main filtered dataset — period + vehicle combined
  const filtered = useMemo(() => {
    let c = activePeriod ? filterByPeriod(charges, activePeriod) : charges
    if (activeVehicle) c = c.filter(x => x.vehicleId === activeVehicle)
    return c
  }, [charges, activePeriod, activeVehicle])

  const stats      = useMemo(() => computeStats(filtered),         [filtered])
  const statsMg4   = useMemo(() => computeStats(filtered, 'mg4'),  [filtered])
  const statsXpeng = useMemo(() => computeStats(filtered, 'xpeng'),[filtered])
  const daily      = useMemo(() => getDailyData(filtered, 30),     [filtered])

  const sorted = useMemo(() => [...charges].sort((a,b)=>b.date.localeCompare(a.date)), [charges])
  const recentFiltered = useMemo(() => {
    let c = sorted
    if (activePeriod) c = c.filter(x => filterByPeriod([x], activePeriod).length > 0)
    if (activeVehicle) c = c.filter(x => x.vehicleId === activeVehicle)
    return c.slice(0, 8)
  }, [sorted, activePeriod, activeVehicle])

  const extPct     = stats.totalKwh > 0 ? Math.round(stats.extKwh/stats.totalKwh*100) : 0
  const avgSession = stats.count > 0 ? (stats.totalKwh/stats.count).toFixed(1) : '—'
  const streak = sorted.length ? Math.floor((new Date()-new Date(sorted[0].date+'T00:00:00'))/86400000) : null

  const periodLabel = activePeriod ? PERIODS.find(p=>p.id===activePeriod)?.label : 'Tout'
  const vehicleLabel = activeVehicle ? VEHICLES[activeVehicle]?.name : 'Tous véhicules'

  function togglePeriod(id)  { setActivePeriod(p  => p===id  ? null : id)  }
  function toggleVehicle(id) { setActiveVehicle(v => v===id ? null : id) }

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

      {/* Period banners — scrollable, selectable */}
      <div style={{ display:'flex', gap:10, overflowX:'auto', scrollbarWidth:'none', padding:'14px 16px 0' }}>
        {periodStats.map(p => {
          const active = activePeriod === p.id
          return (
            <div key={p.id} onClick={()=>togglePeriod(p.id)} style={{
              flexShrink:0, minWidth:155, cursor:'pointer',
              background: active ? `linear-gradient(135deg,${p.accent}30,${p.accent}18)` : `linear-gradient(135deg,${p.accent}14,${p.accent}08)`,
              border: active ? `2px solid ${p.accent}` : `1px solid ${p.accent}30`,
              borderRadius:'var(--r)', padding:'14px 16px',
              boxShadow: active ? `0 0 20px ${p.accent}35` : 'none',
              transition:'all 0.15s',
            }}>
              <div style={{ fontSize:10, color: active ? p.accent : 'var(--muted)', marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{p.label}</div>
              <div className="mono" style={{ fontSize:26, fontWeight:700, lineHeight:1 }}>
                {p.stats.totalKwh.toFixed(0)}<span style={{ fontSize:13, color:'var(--muted)', fontWeight:400 }}> kWh</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                <span style={{ fontSize:11, color:'var(--muted)' }}>{p.stats.count} sessions</span>
                <span className="mono" style={{ fontSize:13, fontWeight:700, color:p.accent }}>{p.stats.totalCost.toFixed(0)} €</span>
              </div>
              {p.stats.avgPrice > 0 && <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{p.stats.avgPrice.toFixed(3)} €/kWh</div>}
            </div>
          )
        })}
      </div>

      {/* Context label */}
      {(activePeriod || activeVehicle) && (
        <div style={{ margin:'10px 16px 0', padding:'8px 12px', background:'rgba(79,142,247,0.08)', border:'1px solid rgba(79,142,247,0.2)', borderRadius:'var(--r-sm)', fontSize:12, color:'var(--accent)', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
          <span>🔍</span>
          <span>Filtre : {[periodLabel, vehicleLabel].filter(Boolean).join(' · ')}</span>
          <button onClick={()=>{setActivePeriod(null);setActiveVehicle(null)}} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }}>✕ Tout</button>
        </div>
      )}

      {/* Vehicle cards */}
      <div style={{ margin:'10px 16px 0' }}>
        <div className="section-label">{`Véhicules — ${periodLabel}`}</div>
        <div style={{ display:'flex', gap:8 }}>
          <VehicleCard v={VEHICLES.mg4}   stats={statsMg4}   total={stats.totalKwh} selected={activeVehicle} onClick={()=>toggleVehicle('mg4')} />
          <VehicleCard v={VEHICLES.xpeng} stats={statsXpeng} total={stats.totalKwh} selected={activeVehicle} onClick={()=>toggleVehicle('xpeng')} />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, margin:'10px 16px 0' }}>
        {[
          { val:`${extPct}%`,    label:'Recharge externe', color:'var(--amber)' },
          { val:`${avgSession}`, label:'kWh/session moy.',  color:'var(--mg4)', mono:true },
          { val: streak !== null ? `${streak}j` : '—', label:'Depuis dernière charge', color: streak===0?'var(--green)':streak>7?'var(--red)':'var(--muted)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding:'11px 12px' }}>
            <div className={k.mono?'mono':''} style={{ fontSize:18, fontWeight:700, color:k.color, lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:9, color:'var(--muted)', marginTop:4, lineHeight:1.3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {filtered.length > 0 && (
        <div style={{ margin:'14px 16px 0' }}>
          <div className="card" style={{ padding:'14px 16px' }}>
            <div className="section-label">{`30 derniers jours — ${periodLabel} · ${vehicleLabel}`}</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={daily} barSize={5} barGap={1}>
                <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:8 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="mg4"   fill="var(--mg4)"   radius={[2,2,0,0]} stackId="a" />
                <Bar dataKey="xpeng" fill="var(--xpeng)" radius={[2,2,0,0]} stackId="a" />
              </BarChart>
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

      {/* Provider donut */}
      {filtered.filter(c=>c.locationId!=='home').length > 0 && (
        <div style={{ margin:'10px 16px 0' }}>
          <ProviderDonut charges={filtered} />
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
            const v = VEHICLES[c.vehicleId]
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
