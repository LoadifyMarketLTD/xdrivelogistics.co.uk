'use client';
import Link from 'next/link';
import type { MasterWorkspaceRole } from './MasterWorkspacePolicy';
import './master-operational-section.css';

type TabRoute={href:string;description:string};
const customer:Readonly<Record<string,TabRoute>>={
  'Post Load':{href:'/customer/post-load',description:'Publish your actual transport requests'},
  'Loads':{href:'/customer/loads',description:'Review your company loads'},
  'Quotes':{href:'/customer/quotes',description:'Manage quotes received from carriers'},
  'Bookings':{href:'/customer/bookings',description:'Review awarded bookings and delivery documents'},
  'Diary':{href:'/customer/diary',description:'View your operational schedule'},
  'Invoices':{href:'/customer/invoices',description:'Review invoices available to your customer account'},
  'Network & Tools':{href:'/customer/network',description:'View authorized customer network tools'},
  'Directory':{href:'/customer/network/directory',description:'Search the shared member directory'},
  'Messages':{href:'/customer/messages',description:'Open authenticated conversations'},
  'Notifications':{href:'/customer/notifications',description:'Review your operational notifications'}
};
const driver:Readonly<Record<string,TabRoute>>={
  'Post Load':{href:'/driver/post-load',description:'Publish a load if your account is authorized'},
  'Loads':{href:'/driver/loads',description:'Find loads available to your driver account'},
  'Quotes':{href:'/driver/quotes',description:'View and manage submitted quotes'},
  'Bookings':{href:'/driver/jobs',description:'Continue assigned jobs, collection evidence and delivery POD'},
  'My Fleet':{href:'/driver/vehicles',description:'View your own assigned vehicle'},
  'Drivers':{href:'/driver/documents',description:'View driver identity and compliance documents'},
  'Diary':{href:'/driver/history',description:'Review completed and active jobs'},
  'Invoices':{href:'/driver/finance',description:'Open permitted owner-driver financial records'},
  'Network & Tools':{href:'/driver/nearby',description:'Open nearby operational tools'},
  'Directory':{href:'/driver/directory',description:'Search the shared member directory'},
  'Live Availability':{href:'/driver/availability/live',description:'Manage your published availability'},
  'Return Journeys':{href:'/driver/returns',description:'Find eligible return journeys'},
  'Messages':{href:'/driver/messages',description:'Open job conversations'},
  'Notifications':{href:'/driver/notifications',description:'View operational alerts'}
};
const ownerOnly=new Set(['Post Load','Invoices']);
const employedRestricted=new Set(['Post Load','Invoices','My Fleet']);
export default function MasterOperationalSection({role,tab,preview=false,href}:{role:MasterWorkspaceRole;tab:string;preview?:boolean;href?:string}){
  const isDriver=['Driver','Owner Driver','Company Driver','Employee Driver'].includes(role);
  const config=href?{href,description:"Open the existing authenticated operation with its full controls"}:(isDriver?driver:customer)[tab];
  const blocked=isDriver&&(role==='Company Driver'||role==='Employee Driver'?employedRestricted.has(tab):role!=='Owner Driver'&&ownerOnly.has(tab));
  return <section className="xd-master-live-tab" aria-label={tab+' operational access'}>
    <header className="xd-master-live-heading"><h1>{tab}</h1><p>{role} · authenticated operations</p></header>
    <div className="xd-master-live-panel">
      <h2>{tab}</h2>
      {!preview&&config&&!blocked?<><p>{config.description}. The existing authenticated workflow, its records and permissions remain authoritative.</p>
        <Link className="xd-master-live-link" href={config.href}>Open {tab}</Link>
      </>:<p role="status">{preview?"No records are loaded in this visual preview. Sign in to access real operations.":"No operational action is available to this role in this section."}</p>}
    </div>
  </section>;
}
