'use client';
import {useRouter} from 'next/navigation';
import {useCompany3150Live} from '../../try-xdrive-demo/components/Company3150LiveData';
import {masterNavigationHref} from '../../../lib/masterWorkspaceNavigation';
import {PageFrame,PageHeader,Panel} from './WorkspaceUI';
import './company-master-dashboard.css';

export default function CompanyMasterDashboard({role}:{role:'Company / Carrier'|'Broker'}){
 const router=useRouter();
 const current=useCompany3150Live();
 const data=current?.data;
 const loads=current?.loads??[];
 const quotes=current?.quotes??[];
 const bookings=current?.bookings??[];
 const invoices=data?.invoices??[];
 const drivers=data?.drivers??[];
 const vehicles=data?.vehicles??[];
 const stats=(()=>{
  const completed=loads.filter(x=>['completed','delivered'].includes((x.operationalStatus||'').toLowerCase()));
  const inProgress=loads.filter(x=>['allocated','assigned','in_transit','loaded','on_site_pickup','on_site_delivery'].includes((x.operationalStatus||'').toLowerCase()));
  const awaitingPOD=completed.filter(x=>!x.podReceived);
  const unpaid=invoices.filter(x=>!['paid','void','cancelled'].includes((x.payment_status||'').toLowerCase())).reduce((sum,x)=>sum+Number(x.amount||0),0);
  return {
   posted:loads.length,quotes:quotes.length,bookings:bookings.length,
   inProgress:inProgress.length,completed:completed.length,awaitingPOD:awaitingPOD.length,
   drivers:drivers.length,vehicles:vehicles.length,unpaid,
  };
 })();
 const navigate=(tab:number)=>{const href=masterNavigationHref(role,tab);if(href)router.push(href);};
 if(!current)return <PageFrame><PageHeader title="Dashboard" description="Loading authenticated company records…"/></PageFrame>;
 if(data?.error)return <PageFrame><PageHeader title="Dashboard" description="The company records could not be loaded."/><p role="alert" className="cmd-error">{data.error}</p></PageFrame>;
 const cards=[
  {label:'Loads',value:stats.posted,tab:2},
  {label:'Quotes',value:stats.quotes,tab:3},
  {label:'Bookings',value:stats.bookings,tab:4},
  {label:'In progress',value:stats.inProgress,tab:7},
  {label:'Delivered',value:stats.completed,tab:7},
  {label:'POD required',value:stats.awaitingPOD,tab:7},
  {label:'Drivers',value:stats.drivers,tab:6},
  {label:'Vehicles',value:stats.vehicles,tab:5},
 ];
 return <PageFrame><PageHeader eyebrow="XDrive Logistics" title="Operations Dashboard" description="Live records scoped to your authorised company"/>
  <div className="cmd-kpis">{cards.map(item=><button type="button" className="cmd-kpi" key={item.label} onClick={()=>navigate(item.tab)}>
    <span>{item.label}</span><strong>{item.value}</strong>
   </button>)}</div>
  <div className="cmd-panels">
   <Panel title="Recent Loads">
    {loads.length?<div className="cmd-rows">{loads.slice(0,10).map(load=><button type="button" key={load.id} className="cmd-row" onClick={()=>router.push(role==='Broker'?'/broker/jobs':'/admin/jobs/'+load.id)}>
     <span className="cmd-route"><strong>{load.from}</strong><span aria-hidden="true"> → </span><strong>{load.to}</strong><small>Ref {load.id.slice(0,8).toUpperCase()}</small></span>
     <span className="cmd-status">{load.operationalStatus||load.status}</span>
    </button>)}</div>:<p className="cmd-empty">No company loads recorded.</p>}
   </Panel>
   <Panel title="Operations & Finance">
    <dl className="cmd-metrics">
     <div><dt>Unpaid invoice total</dt><dd>£{stats.unpaid.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}</dd></div>
     <div><dt>Open quotes</dt><dd>{quotes.filter(x=>x.status==='Open').length}</dd></div>
     <div><dt>Bookings awaiting carrier response</dt><dd>{bookings.filter(x=>(x.operationalStatus||'').toLowerCase()==='awarded').length}</dd></div>
    </dl>
    <button className="cmd-action" onClick={()=>navigate(8)}>Open Invoices</button>
   </Panel>
  </div>
 </PageFrame>;
}
