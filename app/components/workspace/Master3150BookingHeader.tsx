'use client';
import {useCompanyWorkspaceData} from './useCompanyWorkspaceData';
import Master3150OperationsKpis from './Master3150OperationsKpis';
export default function Master3150BookingHeader(){
 const data=useCompanyWorkspaceData();
 if(data.loading)return <p role="status">Loading real booking records…</p>;
 if(data.error)return <p role="alert">Bookings data unavailable: {data.error}</p>;
 return <Master3150OperationsKpis jobs={data.jobs} view="bookings"/>;
}
