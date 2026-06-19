import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { VEHICLES, LOCATIONS } from '../utils.js'
import ComboBox from '../components/ComboBox.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import NearbyStations from '../components/NearbyStations.jsx'
import OperatorLogo from '../components/OperatorLogo.jsx'
import { apiGetFavorites, apiBumpFavorite } from '../api.js'

function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize:11, color: hint.startsWith('⚠') ? 'var(--red)' : 'var(--muted)', marginTop:5 }}>{hint}</div>}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, unit, error }) {
  return (
    <div style={{ display:'flex', alignItems:'center', background:'var(--surface)', border:`1.5px solid ${error?'var(--red)':'var(--border)'}`, borderRadius:'var(--r-sm)', padding:'13px 14px', minWidth:0, width:'100%', boxSizing:'border-box' }}>
      <input type="number" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ flex:1, minWidth:0, width:'100%', background:'none', border:'none', outline:'none', fontSize:16, fontWeight:600, fontFamily:"'JetBrains Mono',monospace", color:value?'var(--text)':'var(--muted)' }} />
      {unit && <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8, flexShrink:0 }}>{unit}</span>}
    </div>
  )
}

function FavoritesSheet({ favorites, onPick, onClose }) {
  return (
    createPortal(
      <>
        <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300 }} />
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderRadius:'20px 20px 0 0', zIndex:301, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.4)', animation:'slideUp 0.2s ease' }}>
          <div style={{ padding:'12px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:16, fontWeight:700 }}>Bornes récentes</div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>×</button>
          </div>
          <div style={{ overflowY:'auto', padding:'10px 16px 32px', display:'flex', flexDirection:'column', gap:8 }}>
            {favorites.map(fav => (
              <div key={fav.id} onClick={()=>{ onPick(fav); onClose() }}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
              >
                <OperatorLogo name={fav.operator || fav.provider || ''} size={28} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{fav.label}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                    {(fav.operator || fav.provider) && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>{fav.operator || fav.provider}</span>}
                    {fav.powerKw && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background:'rgba(79,142,247,0.1)', color:'var(--mg4)', border:'1px solid rgba(79,142,247,0.2)' }}>{fav.powerKw} kW</span>}
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--surface3)', color:'var(--muted)', border:'1px solid var(--border)' }}>{fav.useCount}× utilisé</span>
                  </div>
                </div>
                <span style={{ color:'var(--accent)', fontSize:18, flexShrink:0 }}>→</span>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      </>,
      document.body
    )
  )
}

export default function AddCharge({ account, lists, settings, onSave, onBack, editCharge }) {
  const isEdit = !!editCharge
  const today  = new Date().toISOString().split('T')[0]

  const [vehicleId,    setVehicleId]    = useState(editCharge?.vehicleId    || account.vehicleId)
  const [locationId,   setLocationId]   = useState(editCharge?.locationId   || 'home')
  const [card,         setCard]         = useState(editCharge?.card         || (locationId === 'home' && !isEdit ? 'V2C' : ''))
  const [date,         setDate]         = useState(editCharge?.date         || today)
  const [kwh,          setKwh]          = useState(editCharge?.kwh?.toString()       || '')
  const [totalCost,    setTotalCost]    = useState(editCharge?.totalCost?.toString() || '')
  const [hours,        setHours]        = useState(editCharge ? Math.floor((editCharge.durationMin||0)/60).toString() : '')
  const [minutes,      setMinutes]      = useState(editCharge ? ((editCharge.durationMin||0)%60).toString() : '')
  const [notes,        setNotes]        = useState(editCharge?.notes || '')
  const [startTime,    setStartTime]    = useState(() => {
    if (editCharge) return editCharge.startTime || ''
    const now = new Date()
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  })
  const [errors,       setErrors]       = useState({})

  // Manual provider — only shown when approx location or home
  const [manualProvider, setManualProvider] = useState(editCharge?.provider || (locationId === 'home' && !isEdit ? 'V2C' : ''))

  // GPS location
  const [gpsLocation, setGpsLocation] = useState(
    editCharge?.lat ? {
      lat: editCharge.lat, lng: editCharge.lng,
      label: editCharge.locationName || '',
      approximate: editCharge.locationApproximate,
      ocmId: editCharge.ocmId,
      operator: editCharge.provider || null,
      powerKw: editCharge.powerKw || null,
      connectorTypes: editCharge.connectorTypes || [],
    } : null
  )

  const [favorites, setFavorites] = useState([])
  const [showFavSheet, setShowFavSheet] = useState(false)

  useEffect(() => {
    if (locationId === 'ext') {
      apiGetFavorites().then(setFavorites).catch(() => {})
    }
  }, [locationId])

  // Refresh favorites each time the sheet opens — server recalcs after every save
  useEffect(() => {
    if (showFavSheet) {
      apiGetFavorites().then(setFavorites).catch(() => {})
    }
  }, [showFavSheet])

  // Derived provider: OCM operator > manual
  const isApprox = gpsLocation?.approximate
  const isOcm    = gpsLocation && !isApprox
  const provider = isOcm ? (gpsLocation.operator || '') : manualProvider

  // Show manual provider field when: home OR approx location OR no location set yet
  const showProviderField = locationId === 'home' || !gpsLocation || isApprox

  const kwhNum  = parseFloat(kwh)
  const costNum = parseFloat(totalCost)
  const pricePerKwh = (kwhNum > 0 && costNum > 0) ? costNum / kwhNum : null
  const durationMin = (parseInt(hours)||0)*60 + (parseInt(minutes)||0)

  function applyFavorite(fav) {
    setGpsLocation({
      lat: fav.lat, lng: fav.lng,
      label: fav.label,
      approximate: !fav.ocmId,
      ocmId: fav.ocmId,
      operator: fav.operator,
      powerKw: fav.powerKw,
      connectorTypes: fav.connectorTypes || [],
    })
    if (!fav.ocmId) setManualProvider(fav.provider || fav.operator || '')
  }

  function handleSubmit() {
    const e = {}
    if (!kwh || isNaN(kwhNum) || kwhNum <= 0) e.kwh = true
    if (!totalCost || isNaN(costNum) || costNum < 0) e.cost = true
    if (!date) e.date = true
    if (Object.keys(e).length) { setErrors(e); return }

    const finalProvider = isOcm ? (gpsLocation.operator || '') : manualProvider
    const finalLabel = gpsLocation?.label || LOCATIONS[locationId].label

    const data = {
      ...(isEdit ? { id: editCharge.id } : {}),
      vehicleId, locationId,
      locationName: finalLabel,
      provider: finalProvider,
      card: card.trim(),
      date, kwh: kwhNum, totalCost: costNum,
      durationMin: durationMin || null,
    startTime: startTime || null,
      notes: notes.trim(),
      lat:                 gpsLocation?.lat  || null,
      lng:                 gpsLocation?.lng  || null,
      locationApproximate: gpsLocation?.approximate || false,
      ocmId:               gpsLocation?.ocmId || null,
      powerKw:             gpsLocation?.powerKw || null,
      connectorTypes:      gpsLocation?.connectorTypes || [],
    }

    // Save to favorites if external
    if (locationId === 'ext' && finalLabel) {
      apiBumpFavorite({
        label: finalLabel,
        provider: finalProvider,
        locationId,
        lat: data.lat, lng: data.lng,
        ocmId: data.ocmId,
        operator: gpsLocation?.operator || null,
        powerKw: data.powerKw,
        connectorTypes: data.connectorTypes,
      }).catch(() => {})
    }

    onSave(data)
  }

  return (
    <div className="page fade-up" style={{ paddingBottom:120 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px 0' }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer' }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:700 }}>{isEdit ? 'Modifier la charge' : 'Nouvelle charge'}</div>
          {isEdit && editCharge?.v2cId && (
            <div style={{ fontSize:10, color:'var(--green)', fontWeight:600, display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
              <span>⚡</span><span>Synchronisé V2C Trydan</span>
            </div>
          )}
        </div>
      </div>

      {isEdit && editCharge?.fuelPriceUsed != null && (
        <div className="card" style={{ margin:'12px 16px 0', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>⛽</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:600 }}>
              {editCharge.fuelTypeUsed === 'gazole' ? 'Gazole' : 'SP95'} à {editCharge.fuelPriceUsed.toFixed(3)} €/L
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>
              {editCharge.fuelPriceSource === 'auto'
                ? 'Moyenne des stations à proximité au moment de la charge'
                : editCharge.fuelPriceSource === 'historical_zip'
                ? 'Moyenne historique des stations à proximité à la date de la charge (archive data.gouv.fr)'
                : editCharge.fuelPriceSource === 'manual_old'
                ? 'Tarif de secours (réglages) — session trop ancienne pour le prix temps réel'
                : 'Tarif de secours (réglages) — aucune station trouvée à proximité'}
            </div>
          </div>
          {editCharge.fuelSavings != null && (
            <span style={{ fontSize:13, fontWeight:700, flexShrink:0, color: editCharge.fuelSavings>=0?'var(--green)':'var(--red)' }}>
              {editCharge.fuelSavings>=0?'+':''}{editCharge.fuelSavings.toFixed(2)}€
            </span>
          )}
        </div>
      )}

      {/* Vehicle */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'16px 16px 0' }}>
        {Object.values(VEHICLES).map(v => {
          const active = vehicleId === v.id
          return (
            <button key={v.id} onClick={()=>setVehicleId(v.id)} style={{ padding:'12px 14px', borderRadius:'var(--r-sm)', border:`2px solid ${active?v.color:'var(--border)'}`, background:active?`rgba(${v.id==='mg4'?'79,142,247':'124,92,252'},0.08)`:'var(--surface)', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
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
                <button key={loc.id} onClick={()=>{
                  setLocationId(loc.id)
                  setGpsLocation(null)
                  if (loc.id === 'home' && !isEdit) {
                    if (!manualProvider) setManualProvider('V2C')
                    if (!card) setCard('V2C')
                  } else if (loc.id === 'ext' && !isEdit) {
                    if (manualProvider === 'V2C') setManualProvider('')
                    if (card === 'V2C') setCard('')
                  }
                }} style={{ flex:1, padding:'11px 8px', borderRadius:'var(--r-sm)', border:`1.5px solid ${active?'var(--green)':'var(--border)'}`, background:active?'rgba(34,197,94,0.07)':'var(--surface)', color:active?'var(--green)':'var(--muted)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4, fontSize:12, fontWeight:600 }}>
                  <span style={{ fontSize:20 }}>{loc.emoji}</span>{loc.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Favorites button (external only) */}
        {locationId === 'ext' && favorites.length > 0 && !gpsLocation && (
          <button onClick={()=>setShowFavSheet(true)} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 16px', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', cursor:'pointer', width:'100%', transition:'border-color 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
          >
            <span style={{ fontSize:18 }}>⭐</span>
            <div style={{ flex:1, textAlign:'left' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Bornes récentes</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{favorites.length} borne{favorites.length>1?'s':''} enregistrée{favorites.length>1?'s':''}</div>
            </div>
            <span style={{ color:'var(--muted)', fontSize:16 }}>›</span>
          </button>
        )}
        {showFavSheet && <FavoritesSheet favorites={favorites} onPick={applyFavorite} onClose={()=>setShowFavSheet(false)} />}

        {/* Nearby stations button (external only, no location selected) */}
        {locationId === 'ext' && !gpsLocation && (
          <NearbyStations settings={settings} onPick={(loc) => {
            if (loc._isHome) {
              // Switch to home
              setLocationId('home')
            } else {
              setGpsLocation(loc)
              if (loc.approximate || !loc.operator) setManualProvider(loc.operator || '')
            }
          }} />
        )}

        {/* GPS location (external only) */}
        {locationId === 'ext' && (
          <Field label="Localisation" hint="Recherche une borne ou indique une ville">
            <LocationPicker value={gpsLocation} onChange={setGpsLocation} />
            {/* OCM provider badge */}
            {isOcm && gpsLocation.operator && (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, padding:'10px 12px', background:'var(--surface2)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)' }}>
                <div style={{ width:36, height:36, borderRadius:9, overflow:'hidden', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <OperatorLogo name={gpsLocation.operator} size={36} style={{ width:36, height:36, objectFit:'cover', borderRadius:9 }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{gpsLocation.operator}</div>
                  {gpsLocation.powerKw && <div style={{ fontSize:11, color:'var(--mg4)', fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>{gpsLocation.powerKw} kW</div>}
                </div>
                <span style={{ fontSize:10, color:'var(--green)', fontWeight:600, flexShrink:0 }}>Auto ✓</span>
              </div>
            )}
          </Field>
        )}

        {/* Manual provider — home or approx */}
        {showProviderField && (
          <Field label={locationId === 'home' ? 'Borne / équipement' : 'Fournisseur'} hint={isApprox ? 'Borne non trouvée dans OCM — renseigne le fournisseur' : undefined}>
            <ComboBox
              value={manualProvider}
              onChange={setManualProvider}
              options={lists.providers}
              placeholder={locationId === 'home' ? 'V2C Trydan, Wallbox…' : 'Ionity, TotalEnergies…'}
            />
          </Field>
        )}

        {/* Card */}
        <Field label="Carte utilisée" hint="Ex. Chargemap, RFID maison…">
          <ComboBox value={card} onChange={setCard} options={lists.cards} placeholder="Chargemap, RFID, CB…" />
        </Field>

        {/* Date */}
        <Field label="Date">
          <div style={{ background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'13px 14px' }}>
            <input type="date" value={date} max={today} onChange={e=>setDate(e.target.value)}
              style={{ background:'none', border:'none', outline:'none', fontSize:15, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:'var(--text)', width:'100%', colorScheme:'dark' }} />
          </div>
        </Field>

        {/* kWh + durée */}
        <Field label="Heure de début">
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--r-sm)', padding:'10px 14px' }}>
            <span style={{ fontSize:16 }}>🕐</span>
            <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}
              style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:15, color:'var(--text)', fontFamily:"'JetBrains Mono',monospace", colorScheme:'dark' }} />
            {!editCharge && <button onClick={()=>{ const n=new Date(); setStartTime(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`) }}
              style={{ fontSize:11, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Maintenant</button>}
          </div>
        </Field>

        <Field label="Énergie & durée" hint={errors.kwh?'⚠ Énergie requise':undefined}>
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:8 }}>
            <NumInput value={kwh} onChange={v=>{setKwh(v);setErrors(e=>({...e,kwh:false}))}} placeholder="42" unit="kWh" error={errors.kwh} />
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:6 }}>
              <NumInput value={hours} onChange={setHours} placeholder="2" unit="h" />
              <NumInput value={minutes} onChange={setMinutes} placeholder="30" unit="min" />
            </div>
          </div>
        </Field>

        {/* Coût */}
        <Field label="Coût total" hint={errors.cost?'⚠ Coût requis':undefined}>
          <NumInput value={totalCost} onChange={v=>{setTotalCost(v);setErrors(e=>({...e,cost:false}))}} placeholder="6.72" unit="€" error={errors.cost} />
        </Field>

        {pricePerKwh !== null && (
          <div style={{ background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'var(--r-sm)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--muted)' }}>{kwhNum.toFixed(1)} kWh → prix déduit</span>
            <span className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--green)' }}>{pricePerKwh.toFixed(4)} €/kWh</span>
          </div>
        )}

        {/* Notes */}
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
          <button onClick={()=>{ if (window.confirm('Supprimer cette session de charge ? Cette action est irréversible.')) onSave({ __delete:true, id:editCharge.id }) }} style={{ background:'none', color:'var(--red)', fontSize:13, fontWeight:600, border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-sm)', padding:'12px 16px', cursor:'pointer' }}>
            Supprimer cette charge
          </button>
        )}
      </div>
    </div>
  )
}
