import { useEffect } from 'react'
import DriverSettings from './DriverSettings'
import './DriverMenu.css'
type Role='Owner Driver'|'Company Driver'
const items=[['♙','My Profile','Personal details & driver account'],['▣','My Vehicle','Vehicle details & documents'],['▤','Availability','Set Available / Unavailable'],['♧','Notifications','Job and booking alerts'],['!','Load Alerts','Matching loads and saved alerts'],['▤','Invoices','Create and view invoices'],['⚙','Settings','Preferences & app settings'],['⇥','Log Out','Secure account sign-out']]
export default function DriverMenu({section,setSection,onClose,onNavigate,role,available,setAvailable,savedCount}:{section:string|null;setSection:(s:string|null)=>void;onClose:()=>void;onNavigate:(s:'Invoices'|'Alerts'|'Loads'|'Notifications')=>void;role:Role;available:boolean;setAvailable:(v:boolean)=>void;savedCount:number}){
 useEffect(()=>{const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',f);return()=>document.removeEventListener('keydown',f)},[onClose])
 const action=(name:string)=>{if(name==='Invoices'){onNavigate('Invoices');return}if(name==='Notifications'){onNavigate('Notifications');return}if(name==='Load Alerts'){onNavigate('Alerts');return}setSection(name)}
 return <div className="driver-menu-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="driver-menu-panel" role="dialog" aria-modal="true" aria-label="Driver Menu">
 <div className="driver-menu-heading"><span className="driver-menu-avatar">♙</span><div><strong>{section||'Driver Menu'}</strong><small>{section?'Account and driver tools':'Manage your account and jobs'}</small></div><button type="button" className="driver-menu-close" aria-label="Close menu" onClick={onClose}>×</button></div>
 {section?<div className="driver-menu-content"><button className="driver-menu-back" onClick={()=>setSection(null)}>‹ Back to Menu</button>
 {section==='Availability'?<div className="driver-menu-setting"><h3>Driver availability</h3><p>This setting is saved on this device only.</p><label className="driver-menu-toggle"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/>{available?'Available for new loads':'Unavailable'}</label></div>:
 section==='My Profile'?<div className="driver-menu-setting"><h3>Driver profile</h3><p>Account type: {role}</p><p>Personal account information will appear after the authenticated backend is connected.</p></div>:
 section==='My Vehicle'?<div className="driver-menu-setting"><h3>My Vehicle</h3><p>Vehicle details and documents require the authenticated driver account. No test vehicle is presented as real.</p></div>:
 section==='Saved Loads'?<div className="driver-menu-setting"><h3>Saved Loads</h3><p>{savedCount} load(s) saved on this device.</p><button onClick={()=>onNavigate('Loads')}>View Loads</button></div>:
 section==='Notifications'?<div className="driver-menu-setting"><h3>Notifications</h3><p>Operational notifications will appear here once connected to the authenticated backend. New allocations are highlighted in Bookings.</p></div>:
 section==='Settings'?<div className="driver-menu-setting"><DriverSettings role={role}/></div>:
 <div className="driver-menu-setting"><h3>Log Out</h3><p>Secure sign-out becomes available when authentication is connected. This local preview has no active login session to terminate.</p></div>}
 </div>:<div className="driver-menu-items">{items.filter(([,name])=>name!=='Invoices'||role==='Owner Driver').map(([symbol,name,description])=><button type="button" key={name} className={'driver-menu-item'+(name==='Log Out'?' driver-menu-logout':'')} onClick={()=>action(name)}><span className="driver-menu-symbol">{symbol}</span><span className="driver-menu-label"><strong>{name}</strong><small>{description}</small>{name==='Invoices'&&<em>Owner Driver only</em>}</span><span className="driver-menu-arrow">›</span></button>)}</div>}
 </aside></div>
}
