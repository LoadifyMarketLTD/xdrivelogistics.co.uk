import { useEffect, useRef, useState } from 'react'
import DriverSettings from './DriverSettings'
import { driverGet } from './liveApi'
import { asRecord, asRows, dateLabel, dateTimeLabel, expiryLabel, moneyLabel, positiveNumber, readableLabel, textValue, yesNo, type DriverRecord } from './driverMenuView'
import './DriverMenu.css'

type Role = 'Owner Driver' | 'Company Driver'
type Section = 'My Profile' | 'My Vehicle' | 'Documents' | 'Return Journeys' | 'Availability' | 'Notifications' | 'Load Alerts' | 'Invoices' | 'Settings'
const routes: Partial<Record<Section,string>> = {
 'My Profile':'/profile', 'My Vehicle':'/vehicles', 'Documents':'/documents', 'Return Journeys':'/return-journeys?scope=mine&page_size=10', 'Availability':'/availability-profile',
 'Notifications':'/notifications', 'Load Alerts':'/load-alert-preferences', 'Invoices':'/finance/invoices',
}
const items: Array<{icon:string;title:Section|'Log Out';description:string}> = [
 {icon:'P',title:'My Profile',description:'Personal details and driver account'},
 {icon:'V',title:'My Vehicle',description:'Assigned vehicle and compliance documents'},
 {icon:'D',title:'Documents',description:'Approved driver compliance documents'},
 {icon:'R',title:'Return Journeys',description:'Your return journey availability'},
 {icon:'A',title:'Availability',description:'Availability and destination preference'},
 {icon:'N',title:'Notifications',description:'Job, booking and document updates'},
 {icon:'L',title:'Load Alerts',description:'Matching loads and alert channels'},
 {icon:'I',title:'Invoices',description:'Invoice records and payment status'},
 {icon:'S',title:'Settings',description:'Device and navigation preferences'},
 {icon:'↪',title:'Log Out',description:'Secure account sign-out'},
]
const apiBase = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver'

async function send(path: string, method: 'PUT'|'PATCH'|'POST', token: string, payload?:DriverRecord): Promise<DriverRecord> {
 const response = await fetch(apiBase+path,{
  method,headers:{ Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{}) },
  ...(payload?{body:JSON.stringify(payload)}:{})
 })
 const data = asRecord(await response.json().catch(()=>({})))
 if(!response.ok) throw new Error(textValue(data.error,'This change could not be saved. Please retry.'))
 return data
}

function Details({rows}:{rows:Array<[string,unknown]>}){
 return <dl className="driver-menu-details">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{textValue(value)}</dd></div>)}</dl>
}
function Group({title,children,description}:{title:string;children:React.ReactNode;description?:string}){
 return <section className="driver-menu-group"><header><h3>{title}</h3>{description&&<p>{description}</p>}</header>{children}</section>
}
function Status({value,tone}:{value:string;tone?:'good'|'warn'|'neutral'}){
 return <span className={'driver-menu-status '+(tone||'neutral')}>{value}</span>
}

export default function DriverMenu({section,setSection,onClose,onNavigate,role,setAvailable,savedCount,onLogout,liveConnected,token}:{
 section:string|null;setSection:(s:string|null)=>void;onClose:()=>void;
 onNavigate:(s:'Invoices'|'Alerts'|'Loads'|'Notifications'|'Bookings'|'Quotes')=>void;role:Role;
 available:boolean;setAvailable:(v:boolean)=>void;savedCount:number;onLogout:()=>void;
 liveConnected:boolean;token:string|null
}){
 const [data,setData]=useState<DriverRecord|null>(null)
 const cache=useRef<{token:string;entries:Record<string,DriverRecord>}>({token:'',entries:{}})
 const [documents,setDocuments]=useState<DriverRecord[]>([])
 const [documentsError,setDocumentsError]=useState('')
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [busy,setBusy]=useState(false)
 const [revision,setRevision]=useState(0)
 const [notificationsOnlyUnread,setNotificationsOnlyUnread]=useState(false)
 const [notificationLimit,setNotificationLimit]=useState(20)
 const [name,setName]=useState('')
 const [phone,setPhone]=useState('')


 const [editingJourney,setEditingJourney]=useState<string|null>(null)
 const [journeyDraft,setJourneyDraft]=useState({from:'',to:'',vehicleType:'',availableFrom:'',availableTo:''})
 const [alertEnabled,setAlertEnabled]=useState(false)
 const [alertRadius,setAlertRadius]=useState(30)
 const [alertChannels,setAlertChannels]=useState({inApp:true,email:false,push:false})
 const [matchCurrent,setMatchCurrent]=useState(true)
 const [matchHome,setMatchHome]=useState(false)
 const [homeOutcode,setHomeOutcode]=useState('')
 const [matchFuture,setMatchFuture]=useState(true)
 const [matchVehicle,setMatchVehicle]=useState(true)
 const [minimumBudget,setMinimumBudget]=useState('')
 const [destinationEnabled,setDestinationEnabled]=useState(false)
 const [destinationRadius,setDestinationRadius]=useState(30)

 useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',listener);return()=>document.removeEventListener('keydown',listener)},[onClose])
 useEffect(()=>{
  const path=routes[section as Section]
  if(cache.current.token!==token){cache.current={token:token||'',entries:{}}}
  const cached=path&&revision===0?cache.current.entries[path]:undefined
  setData(cached||null);setError('');setSuccess('');setDocuments([]);setDocumentsError('')
  setNotificationLimit(20);setNotificationsOnlyUnread(false)
  if(!section||!path||!token||!liveConnected){setLoading(false);return}
  let active=true
  setLoading(!cached)
  void driverGet(path,token).then(result=>{
   cache.current.entries[path]=result
   if(!active)return
   setData(result)
   const driver=asRecord(result.driver)
   const pref=asRecord(result.preference)
   if(section==='My Profile'){setName(textValue(driver.display_name,''));setPhone(textValue(driver.phone,''))}
   if(section==='Documents')setDocuments(asRows(result.documents))
   if(section==='Load Alerts'){
    setAlertEnabled(pref.enabled===true)
    setAlertRadius(positiveNumber(pref.radiusMiles,30))
    setAlertChannels({inApp:pref.inAppEnabled===true,email:pref.emailEnabled===true,push:pref.pushEnabled===true})
    setMatchCurrent(pref.currentRadiusEnabled===true)
    setMatchHome(pref.homeOutcodeEnabled===true)
    setHomeOutcode(textValue(pref.homeOutcode,''))
    setMatchFuture(pref.futurePositionEnabled===true)
    setMatchVehicle(pref.requireVehicleMatch===true)
    setMinimumBudget(pref.minimumBudgetGbp==null?'':String(pref.minimumBudgetGbp))
   }
   if(section==='Availability'){
    setDestinationEnabled(driver.destination_priority_enabled===true)
    setDestinationRadius(positiveNumber(driver.destination_radius_miles,30))
   }
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load account data')})
    .finally(()=>{if(active)setLoading(false)})
  if(section==='My Vehicle'){
   void driverGet('/documents',token).then(result=>{if(active)setDocuments(asRows(result.documents))})
     .catch(reason=>{if(active)setDocumentsError(reason instanceof Error?reason.message:'Could not load documents')})
  }
  return()=>{active=false}
 },[section,token,liveConnected,revision])

 async function save(path:string,payload:DriverRecord,message:string):Promise<DriverRecord|null>{
  if(!token||!liveConnected){setError('Sign in to XDrive LIVE to save changes.');return null}
  setBusy(true);setError('');setSuccess('')
  try {
   const result=await send(path,'PUT',token,payload)
   setData(result)
   if(cache.current.token===token)cache.current.entries[path]=result
   setSuccess(result.warning?textValue(result.warning):message)
   return result
  }catch(reason){setError(reason instanceof Error?reason.message:'Save failed');return null}
  finally{setBusy(false)}
 }
 async function updateJourney(){
  if(!token||!editingJourney)return;
  const start=new Date(journeyDraft.availableFrom).getTime();const end=journeyDraft.availableTo?new Date(journeyDraft.availableTo).getTime():null;
  if(!journeyDraft.from.trim()||!journeyDraft.vehicleType.trim()||!Number.isFinite(start)||(end!==null&&(!Number.isFinite(end)||end<=start))){setError('Enter origin, vehicle and valid availability dates.');return}
  setBusy(true);setError('');setSuccess('');
  try{await send('/return-journeys','PATCH',token,{id:editingJourney,from:journeyDraft.from.trim(),to:journeyDraft.to.trim(),vehicleType:journeyDraft.vehicleType.trim(),availableFrom:new Date(start).toISOString(),availableTo:end===null?'':new Date(end).toISOString()});const path=routes['Return Journeys']!;const refreshed=await driverGet(path,token);setData(refreshed);cache.current.entries[path]=refreshed;setEditingJourney(null);setSuccess('Return journey updated.')}catch(reason){setError(reason instanceof Error?reason.message:'Could not update journey.')}finally{setBusy(false)}
 }
 function beginJourneyEdit(journey:DriverRecord){const local=(value:unknown)=>{const v=textValue(value,'');if(!v)return '';const date=new Date(v);if(Number.isNaN(date.getTime()))return '';return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};setEditingJourney(textValue(journey.id));setJourneyDraft({from:textValue(journey.from,''),to:textValue(journey.to,''),vehicleType:textValue(journey.vehicleType,''),availableFrom:local(journey.availableFrom),availableTo:local(journey.availableTo)});setError('');setSuccess('')}
 async function viewDocument(id:string){
  if(!token)return
  const windowRef=window.open('about:blank','_blank')
  if(windowRef)windowRef.opener=null
  setBusy(true);setError('')
  try{
   const result=await driverGet('/documents/'+encodeURIComponent(id)+'/download',token)
   const url=textValue(result.url,'')
   if(!url.startsWith('https://'))throw new Error('A secure document link was not returned.')
   if(windowRef)windowRef.location.replace(url)
   else window.location.assign(url)
  }catch(reason){windowRef?.close();setError(reason instanceof Error?reason.message:'Document unavailable')}
  finally{setBusy(false)}
 }
 async function markRead(id?:string){
  if(!token)return
  setBusy(true);setError('');setSuccess('')
  try{
   await send(id?'/notifications/'+encodeURIComponent(id)+'/read':'/notifications/read-all',id?'PATCH':'POST',token)
   const current=await driverGet('/notifications',token)
   setData(current)
   setSuccess(id?'Notification marked as read.':'All notifications marked as read.')
  }catch(reason){setError(reason instanceof Error?reason.message:'Unable to update notification.')}
  finally{setBusy(false)}
 }

 const driver=asRecord(data?.driver)
 const preference=asRecord(data?.preference)
 const vehicles=asRows(data?.vehicles)
 const notifications=asRows(data?.notifications)
 const invoices=asRows(data?.rows)
 const unread=notifications.filter(item=>!item.read_at)
 const selectedNotifications=notificationsOnlyUnread?unread:notifications
 const shownNotifications=selectedNotifications.slice(0,notificationLimit)
 const postcodeInput=homeOutcode.toUpperCase().replace(/\s/g,'')
 const validOutcode=/^[A-Z]{1,2}\d[A-Z\d]?$/.test(postcodeInput)
 const validFullPostcode=/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(postcodeInput)
 const normalizedOutcode=validFullPostcode?postcodeInput.slice(0,-3):postcodeInput
 const alertValidation = alertEnabled && !matchCurrent && !matchHome && !matchFuture ? 'Choose at least one matching location.' : alertEnabled && !alertChannels.inApp && !alertChannels.email && !alertChannels.push ? 'Choose at least one notification channel.' : matchHome && !validOutcode && !validFullPostcode ? 'Enter a valid postcode area (BB1) or full UK postcode (BB1 9QX).' : minimumBudget!=='' && (!Number.isFinite(Number(minimumBudget)) || Number(minimumBudget)<0 || Number(minimumBudget)>1000000) ? 'Minimum value must be between £0 and £1,000,000.' : ''
 const isSection=Boolean(section)
 return <div className="driver-menu-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
 <aside className="driver-menu-panel" role="dialog" aria-modal="true" aria-label="Driver Menu">
  <div className="driver-menu-heading">
   <img className="driver-menu-brand-logo" src={`${import.meta.env.BASE_URL}xdrive-logo-company-3150.png`} alt="XDrive Logistics" />
   <div><strong>{section||'Driver Menu'}</strong><small>{section?'Driver account and operations':'Your account and jobs'}</small></div>
   <button type="button" className="driver-menu-close" aria-label="Close menu" onClick={onClose}>×</button>
  </div>
  {isSection?<div className="driver-menu-content">
   <button type="button" className="driver-menu-back" onClick={()=>setSection(null)}>← Back to Menu</button>
   {!liveConnected&&section!=='Settings'&&<p className="driver-menu-notice">Sign in to XDrive LIVE to access account information.</p>}
   {loading&&<p role="status" className="driver-menu-notice">Loading your information…</p>}
   {error&&<p role="alert" className="driver-menu-notice error">{error} <button type="button" onClick={()=>setRevision(v=>v+1)}>Retry</button></p>}
   {success&&<p role="status" className="driver-menu-notice saved">{success}</p>}
   {!loading&&data&&section==='My Profile'&&<>
    <Group title="Account details"><Details rows={[
     ['Account type',role],['Email',driver.email],['Account status',readableLabel(driver.status)],
    ]}/></Group>
    <Group title="Edit profile" description="Only information saved to your authenticated Driver account is shown.">
     <label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={160}/></label>
     <label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)} maxLength={40} type="tel"/></label>
     <button type="button" className="driver-menu-primary" disabled={busy} onClick={()=>void save('/profile',{displayName:name.trim(),phone:phone.trim()},'Profile saved to XDrive LIVE.')}>{busy?'Saving…':'Save profile'}</button>
    </Group>
   </>}
   {(section==='My Vehicle'||section==='Documents')&&!loading&&data&&<>
    {section==='My Vehicle'&&(vehicles.length?vehicles.map((vehicle,index)=><Group key={textValue(vehicle.id,String(index))} title={[textValue(vehicle.make,''),textValue(vehicle.model,'')].filter(Boolean).join(' ')||'Assigned vehicle'}>
     <div className="driver-menu-card-top"><strong>{textValue(vehicle.reg_plate,'Registration not provided')}</strong>{vehicle.id===data.canonicalVehicleId&&<Status value="Primary vehicle" tone="good"/>}</div>
     <Details rows={[
      ['Vehicle type',readableLabel(vehicle.type)],['Payload',vehicle.payload_kg==null?'Not provided':String(vehicle.payload_kg)+' kg'],
      ['Pallet capacity',vehicle.pallets_capacity],['Tail lift',yesNo(vehicle.has_tail_lift)],
      ['Straps',yesNo(vehicle.has_straps)],['Blankets',yesNo(vehicle.has_blankets)]
     ]}/>
    </Group>):<Group title="Assigned vehicle"><p className="driver-menu-empty">No vehicles available for your authenticated driver account.</p></Group>)}
    <Group title="Compliance documents" description="Document identifiers and private storage paths are not displayed.">
     {documentsError&&<p role="alert" className="driver-menu-notice error">{documentsError}</p>}
     {!documentsError&&!documents.length&&<p className="driver-menu-empty">No driver documents recorded.</p>}
     {documents.map((document,index)=>{
      const label=readableLabel(document.doc_type,'Document')
      const expiry=expiryLabel(document.expiry_date)
      const status=readableLabel(document.status,'Not reviewed')
      return <article className="driver-menu-record" key={textValue(document.id,String(index))}>
       <div className="driver-menu-card-top"><strong>{label}</strong><Status value={expiry==='Expired'||expiry==='Expiring soon'?expiry:status} tone={expiry==='Expired'||status==='Rejected'?'warn':status==='Approved'?'good':'neutral'}/></div>
       <Details rows={[['Issued',dateLabel(document.issued_date)],['Expires',dateLabel(document.expiry_date)]]}/>
       {Boolean(document.rejection_reason)&&<p className="driver-menu-hint">Review note: {textValue(document.rejection_reason)}</p>}
       {Boolean(document.id)&&<button type="button" className="driver-menu-document-open" disabled={busy} onClick={()=>void viewDocument(String(document.id))}>View document securely</button>}
      </article>
     })}
     <p className="driver-menu-hint">Files open through short-lived, access-controlled document links. Internal storage paths are never displayed.</p>
    </Group>
   </>}
   {section==='Return Journeys'&&!loading&&data&&<Group title="Your return journeys" description="Live return journey records associated with your authenticated driver account.">
    {!asRows(data.journeys).length&&<p className="driver-menu-empty">No return journeys are recorded for this driver.</p>}
    {asRows(data.journeys).map((journey,index)=><article className="driver-menu-record" key={textValue(journey.id,String(index))}>
      <div className="driver-menu-card-top"><strong>{textValue(journey.from,'Origin not provided')} → {textValue(journey.to,'Any destination')}</strong><Status value={!journey.from||!journey.availableFrom||!journey.vehicleType?'Incomplete record':readableLabel(journey.status,'Unknown')} tone={!journey.from||!journey.availableFrom||!journey.vehicleType?'warn':'neutral'}/></div>
      <Details rows={[['Vehicle',readableLabel(journey.vehicleType,'Not specified')],['Available from',dateTimeLabel(journey.availableFrom)],['Available to',dateTimeLabel(journey.availableTo)],['Journey type',readableLabel(journey.journeyKind,'Ad hoc')]]}/>
      {(!journey.from||!journey.availableFrom||!journey.vehicleType)&&<p className="driver-menu-notice error">This saved journey is missing route, availability or vehicle information. It must be corrected before operational use.</p>}
      {Boolean(journey.notes)&&<p className="driver-menu-hint">{textValue(journey.notes)}</p>}

      {editingJourney===textValue(journey.id)?<form className="driver-menu-journey-edit" onSubmit={e=>{e.preventDefault();void updateJourney()}}>
       <label>Origin<input required value={journeyDraft.from} onChange={e=>setJourneyDraft(v=>({...v,from:e.target.value}))}/></label>
       <label>Destination (optional)<input value={journeyDraft.to} onChange={e=>setJourneyDraft(v=>({...v,to:e.target.value}))}/></label>
       <label>Vehicle type<input required value={journeyDraft.vehicleType} onChange={e=>setJourneyDraft(v=>({...v,vehicleType:e.target.value}))}/></label>
       <label>Available from<input type="datetime-local" required value={journeyDraft.availableFrom} onChange={e=>setJourneyDraft(v=>({...v,availableFrom:e.target.value}))}/></label>
       <label>Available to<input type="datetime-local" value={journeyDraft.availableTo} onChange={e=>setJourneyDraft(v=>({...v,availableTo:e.target.value}))}/></label>
       <div className="driver-menu-journey-actions"><button type="submit" disabled={busy}>Save journey</button><button type="button" disabled={busy} onClick={()=>setEditingJourney(null)}>Cancel</button></div>
      </form>:<button type="button" className="driver-menu-journey-edit-button" onClick={()=>beginJourneyEdit(journey)}>Edit journey</button>}

    </article>)}
   </Group>}
   {section==='Availability'&&!loading&&data&&<>
    <Group title="Your current availability">
     <div className="driver-menu-card-top"><strong>{readableLabel(driver.availability_status)}</strong><Status value="LIVE" tone="good"/></div>
     <label className="driver-menu-toggle"><input type="checkbox" checked={driver.availability_status==='available'} disabled={busy} onChange={e=>{const value=e.target.checked;void save('/availability-profile',{availabilityStatus:value?'available':'offline'},'Availability updated.').then(result=>{if(result)setAvailable(value)})}}/><span>Available for new loads</span></label>
     <p className="driver-menu-hint">Your availability is saved to your authenticated Driver profile.</p>
    </Group>
    <Group title="Destination search" description="This is an independent preference from the 30-mile Loads pickup search.">
     <label className="driver-menu-toggle"><input type="checkbox" checked={destinationEnabled} onChange={e=>setDestinationEnabled(e.target.checked)}/><span>Prioritise jobs near my delivery destination</span></label>
     <label>Destination radius<select value={destinationRadius} onChange={e=>setDestinationRadius(Number(e.target.value))}>{[10,20,30,50,100,200,300].map(value=><option key={value} value={value}>{value} miles</option>)}</select></label>
     <button type="button" className="driver-menu-primary" disabled={busy} onClick={()=>void save('/availability-profile',{destinationPriorityEnabled:destinationEnabled,destinationRadiusMiles:destinationRadius},'Destination preferences saved.')}>{busy?'Saving…':'Save destination preferences'}</button>
    </Group>
   </>}
   {section==='Notifications'&&!loading&&data&&<>
    <Group title="Notification inbox">
     <div className="driver-menu-card-top"><span>{notifications.length} notifications · {unread.length} unread</span><button type="button" disabled={busy||unread.length===0} onClick={()=>void markRead()}>Mark all as read</button></div>
     <div className="driver-menu-filters" role="group" aria-label="Notification filter"><button type="button" aria-pressed={!notificationsOnlyUnread} onClick={()=>{setNotificationsOnlyUnread(false);setNotificationLimit(20)}}>All</button><button type="button" aria-pressed={notificationsOnlyUnread} onClick={()=>{setNotificationsOnlyUnread(true);setNotificationLimit(20)}}>Unread only</button></div>
     {!notifications.length&&<p className="driver-menu-empty">No notifications received.</p>}
     {shownNotifications.map((entry,index)=><article className={'driver-menu-record'+(!entry.read_at?' unread':'')} key={textValue(entry.id,String(index))}>
      <div className="driver-menu-card-top"><strong>{readableLabel(entry.title,readableLabel(entry.type,'Notification'))}</strong><Status value={entry.read_at?'Read':'Unread'} tone={entry.read_at?'neutral':'good'}/></div>
      {Boolean(entry.body)&&<p>{textValue(entry.body)}</p>}
      <div className="driver-menu-card-foot"><small>{dateTimeLabel(entry.created_at)}</small>{!entry.read_at&&<button type="button" disabled={busy||!entry.id} onClick={()=>void markRead(String(entry.id))}>Mark as read</button>}</div>
      {['job_assigned','bid_accepted','exception_pod_alert','exception_operational_alert','feedback_requested'].includes(textValue(entry.type,''))&&<button type="button" className="driver-menu-document-open" onClick={()=>onNavigate('Bookings')}>Open Bookings</button>}
      {entry.type==='exception_finance_alert'&&role==='Owner Driver'&&<button type="button" className="driver-menu-document-open" onClick={()=>onNavigate('Invoices')}>Open Invoices</button>}
      {entry.type==='compliance_documents_missing'&&<button type="button" className="driver-menu-document-open" onClick={()=>setSection('My Vehicle')}>Review documents</button>}
     </article>)}
     {selectedNotifications.length>shownNotifications.length&&<button type="button" className="driver-menu-more" onClick={()=>setNotificationLimit(n=>n+20)}>Show more notifications ({selectedNotifications.length-shownNotifications.length} remaining)</button>}
    </Group>
   </>}
   {section==='Load Alerts'&&!loading&&data&&<>
    <Group title="Matching load alerts" description="Real alert preferences saved to your Driver account.">
     <label className="driver-menu-toggle"><input type="checkbox" checked={alertEnabled} onChange={e=>setAlertEnabled(e.target.checked)}/><span>Enable load alerts</span></label>
     <label>Alert radius<select value={alertRadius} onChange={e=>setAlertRadius(Number(e.target.value))}>{[10,20,30,50,100,200,300].map(value=><option key={value} value={value}>{value} miles</option>)}</select></label>
     <p className="driver-menu-hint">Default: 30 miles. Alert radius and Loads search radius are separate settings.</p>
     <label className="driver-menu-toggle"><input type="checkbox" checked={matchCurrent} onChange={e=>setMatchCurrent(e.target.checked)}/><span>Match near my current position</span></label>
     <label className="driver-menu-toggle"><input type="checkbox" checked={matchHome} onChange={e=>setMatchHome(e.target.checked)}/><span>Include jobs near my home area</span></label>
     {matchHome&&<label>Home postcode area or full UK postcode<input placeholder="e.g. BB1 or BB1 9QX" value={homeOutcode} maxLength={9} onChange={e=>setHomeOutcode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/></label>}
     <label className="driver-menu-toggle"><input type="checkbox" checked={matchFuture} onChange={e=>setMatchFuture(e.target.checked)}/><span>Include my planned future location</span></label>
     <label className="driver-menu-toggle"><input type="checkbox" checked={matchVehicle} onChange={e=>setMatchVehicle(e.target.checked)}/><span>Match loads to my vehicle</span></label>
     <label>Minimum load value (£, optional)<input inputMode="decimal" type="number" min="0" step="0.01" value={minimumBudget} onChange={e=>setMinimumBudget(e.target.value)} placeholder="No minimum"/></label>
    </Group>
    <Group title="Notification channels">
     <label className="driver-menu-toggle"><input type="checkbox" checked={alertChannels.inApp} onChange={e=>setAlertChannels(previous=>({...previous,inApp:e.target.checked}))}/><span>In-app alerts</span></label>
     <label className="driver-menu-toggle"><input type="checkbox" checked={alertChannels.email} onChange={e=>setAlertChannels(previous=>({...previous,email:e.target.checked}))}/><span>Email alerts</span></label>
     <label className="driver-menu-toggle"><input type="checkbox" checked={alertChannels.push} onChange={e=>setAlertChannels(previous=>({...previous,push:e.target.checked}))}/><span>Push notifications</span></label>
     <p className="driver-menu-hint">Push notifications also require browser permission and a supported device.</p>
     {alertValidation&&<p role="alert" className="driver-menu-notice error">{alertValidation}</p>}
     <button type="button" className="driver-menu-primary" disabled={busy||Boolean(alertValidation)} onClick={()=>void save('/load-alert-preferences',{
      enabled:alertEnabled,radiusMiles:alertRadius,
      currentRadiusEnabled:matchCurrent,
      homeOutcodeEnabled:matchHome,
      homeOutcode:normalizedOutcode,
      futurePositionEnabled:matchFuture,
      currentLocationMaxAgeMinutes:positiveNumber(preference.currentLocationMaxAgeMinutes,120),
      requireVehicleMatch:matchVehicle,
      minimumBudgetGbp:minimumBudget===''?null:Number(minimumBudget),
      inAppEnabled:alertChannels.inApp,emailEnabled:alertChannels.email,pushEnabled:alertChannels.push,
     },'Load alert preferences saved to XDrive LIVE.')}>{busy?'Saving…':'Save alert preferences'}</button>
    </Group>
   </>}
   {section==='Invoices'&&!loading&&data&&<>
    <Group title="Invoice history" description="Real invoices for your authorised Owner Driver account.">
     {!invoices.length&&<p className="driver-menu-empty">No invoices found for this account.</p>}
     {invoices.map((invoice,index)=><article className="driver-menu-record" key={textValue(invoice.id,String(index))}>
      <div className="driver-menu-card-top"><strong>{textValue(invoice.invoice_number,'Invoice')}</strong><Status value={readableLabel(invoice.status,'Draft')}/></div>
      <Details rows={[['Customer',invoice.client_name],['Amount',moneyLabel(invoice.amount,invoice.currency)],['Due',dateLabel(invoice.due_date)],['Payment',readableLabel(invoice.payment_status,'Not recorded')]]}/>
     </article>)}
     <button type="button" className="driver-menu-primary" onClick={()=>onNavigate('Invoices')}>Open invoice workflow</button>
    </Group>
   </>}
   {section==='Settings'&&<Group title="Device preferences"><DriverSettings role={role}/><p className="driver-menu-hint">These settings apply on this device. Account availability and load alerts are saved separately in their LIVE sections.</p></Group>}
  </div>:
  <div className="driver-menu-items"><p className="driver-menu-category">ACCOUNT & VEHICLE</p>{items.filter(item=>item.title!=='Invoices'||role==='Owner Driver').map((item,index)=><div key={item.title}>{index===3&&<p className="driver-menu-category">OPERATIONS</p>}{index===5&&<p className="driver-menu-category">UPDATES & FINANCE</p>}{item.title==='Settings'&&<p className="driver-menu-category">PREFERENCES</p>}{item.title==='Log Out'&&<div className="driver-menu-separator"/>}<button type="button" key={item.title} className={'driver-menu-item'+(item.title==='Log Out'?' driver-menu-logout':'')} onClick={()=>item.title==='Log Out'?onLogout():setSection(item.title)}>
   <span className="driver-menu-symbol" aria-hidden="true">{item.icon}</span>
   <span className="driver-menu-label"><strong>{item.title}</strong><small>{item.description}</small>{item.title==='Invoices'&&<em>Owner Driver only</em>}</span>
   <span className="driver-menu-arrow" aria-hidden="true">›</span>
  </button></div>)}
  <p className="driver-menu-hint driver-menu-saved">Saved loads on this device: {savedCount}</p>
  </div>}
 </aside></div>
}
