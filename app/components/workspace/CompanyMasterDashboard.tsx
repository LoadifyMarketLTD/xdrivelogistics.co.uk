'use client';
import {useRouter} from 'next/navigation';
import {useCompany3150Live} from '../../try-xdrive-demo/components/Company3150LiveData';
import {masterNavigationHref} from '../../../lib/masterWorkspaceNavigation';
import Master3150DashboardLayout from './Master3150DashboardLayout';

export default function CompanyMasterDashboard({role}:{role:'Company / Carrier'|'Broker'|'Customer'}){
 const router=useRouter();
 const real=useCompany3150Live();
 if(!real||real.data.loading)return <p role="status">Loading live XDrive operations…</p>;
 if(real.data.error)return <p role="alert">Production records unavailable: {real.data.error}</p>;
 const navigate=(tab:number)=>{
  const href=masterNavigationHref(role,tab);
  if(href)router.push(href);
 };
 const onOpenJob=(id:string)=>router.push((role==='Broker'?'/broker/jobs/':role==='Customer'?'/customer/jobs/':'/admin/jobs/')+encodeURIComponent(id));
 return <Master3150DashboardLayout data={real.data} workspaceLabel={role} go={navigate} onOpenJob={onOpenJob}/>;
}
