import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { computeStats, filterByPeriod, getWeeklyData, formatCost, formatDate, formatDuration, VEHICLES, LOCATIONS } from '../utils.js'
import OperatorLogo from '../components/OperatorLogo.jsx'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.fill, fontWeight: 600 }}>
          {p.dataKey === 'mg4' ? 'MG4' : 'Xpeng G6'}: {p.value.toFixed(0)} kWh
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ charges, onNavigate }) {
  const monthCharges = useMemo(() => filterByPeriod(charges, 'month'), [charges])
  const stats    = useMemo(() => computeStats(monthCharges), [monthCharges])
  const statsMg4 = useMemo(() => computeStats(monthCharges, 'mg4'), [monthCharges])
  const statsG6  = useMemo(() => computeStats(monthCharges, 'xpeng'), [monthCharges])
  const weekly   = useMemo(() => getWeeklyData(charges, 6), [charges])
  const recent   = charges.slice(0, 4)

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page fade-up">
      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Tableau de bord</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, textTransform: 'capitalize' }}>{dateStr}</div>
        </div>
        <button onClick={() => onNavigate('add')} style={{
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          border: 'none', borderRadius: 12, padding: '8px 14px',
          color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 14px var(--accent-glow)',
        }}>＋ Charge</button>
      </div>

      {/* Month banner */}
      <div style={{ margin: '14px 16px 0' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(79,142,247,0.18), rgba(124,92,252,0.10))',
          border: '1px solid rgba(79,142,247,0.25)',
          borderRadius: 'var(--r)', padding: '16px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Ce mois-ci</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
              {stats.totalKwh.toFixed(0)}<span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 400 }}> kWh</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{stats.count} session{stats.count !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Coût total</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
              {stats.totalCost.toFixed(0)}<span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 400 }}>€</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 3 }}>
              {stats.avgPrice > 0 ? `${stats.avgPrice.toFixed(3)} €/kWh moy.` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '10px 16px 0' }}>
        {[
          { val: statsMg4.totalKwh.toFixed(0), label: 'MG4 kWh', color: 'var(--mg4)' },
          { val: statsG6.totalKwh.toFixed(0),  label: 'G6 kWh',  color: 'var(--xpeng)' },
          { val: stats.totalKwh > 0 ? Math.round(stats.homeKwh / stats.totalKwh * 100) + '%' : '—', label: '🏠 Maison', color: 'var(--green)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '12px 14px' }}>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      {charges.length > 0 && (
        <div style={{ margin: '14px 16px 0' }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="section-label">6 dernières semaines</div>
            <ResponsiveContainer width="100%" height={85}>
              <BarChart data={weekly} barSize={10} barGap={2}>
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="mg4" fill="var(--mg4)" radius={[3,3,0,0]} opacity={0.85} />
                <Bar dataKey="xpeng" fill="var(--xpeng)" radius={[3,3,0,0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 10, fontWeight: 500 }}>
              {[{c:'var(--mg4)',l:'MG4'},{c:'var(--xpeng)',l:'Xpeng G6'}].map(i => (
                <div key={i.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: i.c }} />{i.l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent */}
      <div style={{ margin: '14px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Dernières sessions</div>
          {charges.length > 4 && (
            <button onClick={() => onNavigate('history')} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
              Voir tout →
            </button>
          )}
        </div>
        <div className="card" style={{ padding: '0 16px' }}>
          {recent.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              Aucune session encore.
              <div style={{ marginTop: 10 }}>
                <button onClick={() => onNavigate('add')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Ajouter la première →
                </button>
              </div>
            </div>
          ) : recent.map((c, idx) => {
            const v = VEHICLES[c.vehicleId]
            const loc = LOCATIONS[c.locationId]
            return (
              <div key={c.id} onClick={() => onNavigate('edit', c)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: idx < recent.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: v.dimColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {v.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</span>
                    <span className={`badge ${loc.badgeClass}`} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                    <OperatorLogo name={c.provider || ''} size={12} />
                    {c.provider || c.locationName || loc.label}
                  </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {formatDate(c.date)}{c.durationMin ? ` · ${formatDuration(c.durationMin)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{c.kwh} kWh</div>
                  <div style={{ fontSize: 11, color: c.locationId !== 'home' ? 'var(--amber)' : 'var(--green)', marginTop: 1, fontWeight: 600 }}>
                    {formatCost(c.totalCost)}
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
