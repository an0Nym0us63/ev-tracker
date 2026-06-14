import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { computeStats, filterByPeriod, getMonthlyData, getWeeklyData, VEHICLES, formatCost } from '../utils.js'

const PERIODS = [{id:'7d',label:'7j'},{id:'month',label:'Ce mois'},{id:'3m',label:'3 mois'},{id:'all',label:'Tout'}]

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.fill||'var(--text)', fontWeight:600 }}>
          {p.name}: {p.value.toFixed(p.dataKey==='cost'?2:0)}{p.dataKey==='cost'?' €':' kWh'}
        </div>
      ))}
    </div>
  )
}

export default function Stats({ charges }) {
  const [period, setPeriod] = useState('month')
  const filtered = useMemo(() => filterByPeriod(charges, period), [charges, period])
  const stats    = useMemo(() => computeStats(filtered), [filtered])
  const statsMg4 = useMemo(() => computeStats(filtered,'mg4'), [filtered])
  const statsG6  = useMemo(() => computeStats(filtered,'xpeng'), [filtered])
  const monthly  = useMemo(() => getMonthlyData(charges,6), [charges])
  const weekly   = useMemo(() => getWeeklyData(charges,8), [charges])

  const pieData = [
    { name:'Maison', value:stats.homeKwh, color:'var(--green)' },
    { name:'Externe', value:stats.extKwh, color:'var(--amber)' },
  ].filter(d => d.value > 0)

  const consoL100 = stats.consoKwh100 ? stats.consoKwh100 * 0.1 : null

  return (
    <div className="page fade-up">
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Statistiques</div>
      </div>

      {/* Period */}
      <div style={{ display:'flex', gap:6, padding:'12px 16px 0' }}>
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600,
            border:`1.5px solid ${period===p.id?'var(--accent)':'var(--border)'}`,
            background: period===p.id?'rgba(79,142,247,0.1)':'var(--surface)',
            color: period===p.id?'var(--accent)':'var(--muted)',
            cursor:'pointer', transition:'all 0.12s',
          }}>{p.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
          Aucune session sur cette période.
        </div>
      ) : (<>
        {/* KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'12px 16px 0' }}>
          {[
            { icon:'⚡', val:`${stats.totalKwh.toFixed(0)} kWh`, label:'Énergie totale' },
            { icon:'💶', val:formatCost(stats.totalCost), label:'Coût total' },
            { icon:'📊', val:`${stats.avgPrice.toFixed(3)} €`, label:'Prix moyen /kWh' },
            { icon:'🔁', val:stats.count, label:`Session${stats.count>1?'s':''}` },
          ].map(k => (
            <div key={k.label} className="card">
              <div style={{ fontSize:20, marginBottom:8 }}>{k.icon}</div>
              <div className="mono" style={{ fontSize:22, fontWeight:700, lineHeight:1.1 }}>{k.val}</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Par véhicule */}
        <div style={{ padding:'12px 16px 0' }}>
          <div className="section-label">Par véhicule</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[{v:VEHICLES.mg4,s:statsMg4},{v:VEHICLES.xpeng,s:statsG6}]
              .filter(({s})=>s.count>0)
              .map(({v,s}) => (
              <div key={v.id} className="card" style={{ padding:'12px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:20 }}>{v.emoji}</span>
                    <span style={{ fontWeight:600, color:v.color }}>{v.name}</span>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>{s.count} session{s.count>1?'s':''}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="mono" style={{ fontWeight:700 }}>{s.totalKwh.toFixed(0)} kWh</div>
                    <div className="mono" style={{ fontSize:12, color:'var(--green)' }}>{formatCost(s.totalCost)}</div>
                  </div>
                </div>
                {stats.totalKwh > 0 && (
                  <div style={{ marginTop:10, height:4, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:4, background:v.color, width:`${(s.totalKwh/stats.totalKwh*100).toFixed(0)}%`, transition:'width 0.4s ease' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Donut */}
        {pieData.length > 0 && (
          <div style={{ padding:'12px 16px 0' }}>
            <div className="section-label">Maison vs Externe</div>
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <PieChart width={90} height={90}>
                  <Pie data={pieData} cx={45} cy={45} innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
                    {pieData.map((d,i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:d.color, flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>
                          {d.name} <span className="mono">{d.value.toFixed(0)} kWh</span>
                        </div>
                        <div style={{ fontSize:10, color:'var(--muted)' }}>
                          {stats.totalKwh>0?Math.round(d.value/stats.totalKwh*100):0}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conso réelle */}
        <div style={{ padding:'12px 16px 0' }}>
          <div className="section-label">Consommation réelle</div>
          {stats.consoKwh100 ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div className="card">
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>kWh facturés / 100 km</div>
                <div className="mono" style={{ fontSize:22, fontWeight:700 }}>{stats.consoKwh100.toFixed(1)}</div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>Pertes AC/DC incluses</div>
              </div>
              <div className="card">
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Équivalent thermique</div>
                <div className="mono" style={{ fontSize:22, fontWeight:700 }}>{consoL100.toFixed(1)} L</div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>1 kWh ≈ 0.1 L essence</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign:'center', padding:16, color:'var(--muted)', fontSize:12 }}>
              <div style={{ fontSize:20, marginBottom:6 }}>📍</div>
              Renseigne le kilométrage à la charge pour calculer la conso réelle
            </div>
          )}
        </div>

        {/* Monthly cost */}
        <div style={{ padding:'12px 16px 0' }}>
          <div className="section-label">Coût mensuel (6 mois)</div>
          <div className="card">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={monthly} barSize={22}>
                <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="cost" name="Coût" fill="var(--accent)" radius={[4,4,0,0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly */}
        <div style={{ padding:'12px 16px 0' }}>
          <div className="section-label">kWh par semaine</div>
          <div className="card">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weekly} barSize={10} barGap={2}>
                <XAxis dataKey="label" tick={{ fill:'var(--muted)', fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="mg4" name="MG4" fill="var(--mg4)" radius={[3,3,0,0]} opacity={0.85} />
                <Bar dataKey="xpeng" name="Xpeng G6" fill="var(--xpeng)" radius={[3,3,0,0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:14, marginTop:8, fontSize:10, fontWeight:500 }}>
              {[{c:'var(--mg4)',l:'MG4'},{c:'var(--xpeng)',l:'Xpeng G6'}].map(i=>(
                <div key={i.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:i.c }}/>{i.l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </>)}
    </div>
  )
}
