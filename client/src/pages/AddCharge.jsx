import React, { useState, useEffect } from 'react'
import { VEHICLES, LOCATIONS } from '../utils.js'
import ComboBox from '../components/ComboBox.jsx'

function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>{hint}</div>}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, unit, error }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface)', border:`1.5px solid ${error?'var(--red)':'var(--border)'}`, borderRadius:'var(--r-sm)', padding:'13px 14px' }}>
      <input type="number" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:16, fontWeight:600, fontFamily:"'JetBrains Mono',monospace", color:value?'var(--text)':'var(--muted)' }} />
      {unit && <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8, flexShrink:0 }}>{unit}</span>}
    </div>
  )
}

export default function AddCharge({ account, lists, onSave, onBack, editCharge }) {
  const isEdit = !!editCharge
  const today  = new Date().toISOString().split('T')[0]

  const [vehicleId,    setVehicleId]    = useState(editCharge?.vehicleId    || account.vehicleId)
  const [locationId,   setLocationId]   = useState(editCharge?.locationId   || 'home')
  const [locationName, setLocationName] = useState(editCharge?.locationName || '')
  const [provider,     setProvider]     = useState(editCharge?.provider     || '')
  const [card,         setCard]         = useState(editCharge?.card         || '')
  const [date,         setDate]         = useState(editCharge?.date         || today)
  const [kwh,          setKwh]          = useState(editCharge?.kwh?.toString()       || '')
  const [totalCost,    setTotalCost]    = useState(editCharge?.totalCost?.toString() || '')
  const [hours,        setHours]        = useState(editCharge ? Math.floor((editCharge.durationMin||0)/60).toString() : '')
  const [minutes,      setMinutes]      = useState(editCharge ? ((editCharge.durationMin||0)%60).toString() : '')
  const [odometer,     setOdometer]     = useState(editCharge?.odometer?.toString()  || '')
  const [notes,        setNotes]        = useState(editCharge?.notes || '')
  const [errors,       setErrors]       = useState({})

  useEffect(() => {
    if (locationId === 'home' && !isEdit && !provider) setProvider('V2C Trydan')
    else if (locationId !== 'home' && provider === 'V2C Trydan') setProvider('')
  }, [locationId])

  const kwhNum  = parseFloat(kwh)
  const costNum = parseFloat(totalCost)
  const pricePerKwh = (kwhNum > 0 && costNum > 0) ? costNum / kwhNum : null
  const durationMin = (parseInt(hours)||0)*60 + (parseInt(minutes)||0)

  function handleSubmit() {
    const e = {}
    if (!kwh || isNaN(kwhNum) || kwhNum <= 0) e.kwh = true
    if (!totalCost || isNaN(costNum) || costNum < 0) e.cost = true
    if (!date) e.date = true
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({
      ...(isEdit ? { id: editCharge.id } : {}),
      vehicleId, locationId,
      locationName: locationName.trim() || LOCATIONS[locationId].label,
      provider: provider.trim(), card: card.trim(),
      date, kwh: kwhNum, totalCost: costNum,
      durationMin: durationMin || null,
      odometer: odometer ? parseInt(odometer) : null,
      notes: notes.trim(),
    })
  }

  return (
    <div className="page fade-up" style={{ paddingBottom:120 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px 0' }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer' }}>←</button>
        <div style={{ fontSize:20, fontWeight:700 }}>{isEdit ? 'Modifier la charge' : 'Nouvelle charge'}</div>
      </div>

      {/* Vehicle */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'16px 16px 0' }}>
        {Object.values(VEHICLES).map(v => {
          const active = vehicleId === v.id
          return (
            <button key={v.id} onClick={() => setVehicleId(v.id)} style={{ padding:'12px 14px', borderRadius:'var(--r-sm)', border:`2px solid ${active?v.color:'var(--border)'}`, background:active?`rgba(${v.id==='mg4'?'79,142,247':'124,92,252'},0.08)`:'var(--surface)', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <span style={{ fontSize:22 }}>{v.emoji}</span>
              <div style={{ fontSize:13, fontWeight:600, color:active?v.color:'var(--text)' }}>{v.name}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'16px 16px 0' }}>

        {/* Location type */}
        <Field label="Type de charge">
          <div style={{ display:'flex', gap:8 }}>
            {Object.values(LOCATIONS).map(loc => {
              const active = locationId === loc.id
              return (
                <button key={loc.id} onClick={() => setLocationId(loc.id)} style={{ flex:1, padding:'11px 8px', borderRadius:'var(--r-sm)', border:`1.5px solid ${active?'var(--green)':'var(--border)'}`, background:active?'rgba(34,197,94,0.07)':'var(--surface)', color:active?'var(--green)':'var(--muted)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
                  <span style={{ fontSize:20 }}>{loc.emoji}</span>{loc.label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Fournisseur" hint={locationId==='home'?'Ex. V2C Trydan, EDF…':'Ex. Ionity, TotalEnergies, Lidl…'}>
          <ComboBox value={provider} onChange={setProvider} options={lists.providers} placeholder={locationId==='home'?'V2C Trydan':'Ionity, TotalEnergies…'} />
        </Field>

        <Field label="Carte utilisée" hint="Ex. Chargemap, RFID maison…">
          <ComboBox value={card} onChange={setCard} options={lists.cards} placeholder="Chargemap, RFID, CB…" />
        </Field>

        <Field label="Lieu">
          <div style={{ background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'13px 14px' }}>
            <input type="text" value={locationName} onChange={e=>setLocationName(e.target.value)}
              placeholder={locationId==='home'?'Garage, entrée…':'Parking Carrefour, Aire A6 Mâcon…'}
              style={{ width:'100%', background:'none', border:'none', outline:'none', fontSize:15, color:'var(--text)', fontFamily:'inherit' }} />
          </div>
        </Field>

        <Field label="Date">
          <div style={{ background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'13px 14px' }}>
            <input type="date" value={date} max={today} onChange={e=>setDate(e.target.value)}
              style={{ background:'none', border:'none', outline:'none', fontSize:15, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:'var(--text)', width:'100%', colorScheme:'dark' }} />
          </div>
        </Field>

        <Field label="Énergie & durée" hint={errors.kwh?'⚠ Énergie requise':undefined}>
          <div style={{ display:'flex', gap:8 }}>
            <NumInput value={kwh} onChange={v=>{setKwh(v);setErrors(e=>({...e,kwh:false}))}} placeholder="42" unit="kWh" error={errors.kwh} />
            <NumInput value={hours} onChange={setHours} placeholder="2" unit="h" />
            <NumInput value={minutes} onChange={setMinutes} placeholder="30" unit="min" />
          </div>
        </Field>

        <Field label="Coût total" hint={errors.cost?'⚠ Coût requis':undefined}>
          <NumInput value={totalCost} onChange={v=>{setTotalCost(v);setErrors(e=>({...e,cost:false}))}} placeholder="6.72" unit="€" error={errors.cost} />
        </Field>

        {pricePerKwh !== null && (
          <div style={{ background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'var(--r-sm)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--muted)' }}>{kwhNum.toFixed(1)} kWh → prix déduit</span>
            <span className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--green)' }}>{pricePerKwh.toFixed(4)} €/kWh</span>
          </div>
        )}

        <Field label="Kilométrage (optionnel)" hint="Compteur au moment de brancher — calcul conso réelle">
          <NumInput value={odometer} onChange={setOdometer} placeholder="18 420" unit="km" />
        </Field>

        <Field label="Notes (optionnel)">
          <div style={{ background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'12px 14px' }}>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Autoroute A6, retour vacances…" rows={2}
              style={{ width:'100%', background:'none', border:'none', outline:'none', fontSize:14, color:'var(--text)', resize:'none', lineHeight:1.5, fontFamily:'inherit' }} />
          </div>
        </Field>

        <button onClick={handleSubmit} style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', color:'white', fontSize:15, fontWeight:700, borderRadius:'var(--r-sm)', padding:16, border:'none', cursor:'pointer', boxShadow:'0 4px 20px var(--accent-glow)' }}>
          ⚡ {isEdit ? 'Enregistrer les modifications' : 'Enregistrer la charge'}
        </button>

        {isEdit && (
          <button onClick={() => onSave({ __delete:true, id:editCharge.id })} style={{ background:'none', color:'var(--red)', fontSize:13, fontWeight:600, border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-sm)', padding:'12px 16px', cursor:'pointer' }}>
            Supprimer cette charge
          </button>
        )}
      </div>
    </div>
  )
}
