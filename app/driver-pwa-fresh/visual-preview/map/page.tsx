'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useSearchParams,useRouter} from 'next/navigation';
import {demoJobs} from '../../demoState';
const LoadMap=dynamic(()=>import('../../../components/workspace/MarketplaceLoadMap'),{ssr:false});
export default function DemoRouteMap(){
 const params=useSearchParams();const router=useRouter();const id=params.get('load')||'visual-1';const job=demoJobs.find(item=>item.id===id);
 if(!job)return <main className="fresh-content"><p>Demo job not found.</p><Link href="/driver-pwa-fresh/visual-preview">Back to Jobs</Link></main>;
 return <><header className="fresh-header fresh-preview-details-header"><Link className="fresh-back" href={'/driver-pwa-fresh/visual-preview/details?load='+encodeURIComponent(id)}>Back</Link><h1>Route</h1></header><main className="fresh-content"><p><strong>{job.pickup_area} {job.pickup_postcode_area}</strong> to <strong>{job.delivery_area} {job.delivery_postcode_area}</strong></p><LoadMap loads={[{id:job.id,pickupLabel:job.pickup_area+' '+job.pickup_postcode_area,pickupPostcode:job.pickup_postcode_area,deliveryLabel:job.delivery_area+' '+job.delivery_postcode_area,deliveryPostcode:job.delivery_postcode_area,vehicleLabel:job.vehicle_type||'Van',posterName:job.member?.name||'XDrive',pickupAt:job.pickup_datetime,postedAt:job.exchange_posted_at}]} onQuote={()=>router.push('/driver-pwa-fresh/visual-preview/quote?load='+encodeURIComponent(id))} onDetails={()=>router.push('/driver-pwa-fresh/visual-preview/details?load='+encodeURIComponent(id))}/><p>Demo map uses approximate postcode-area locations, not verified vehicle routing or journey time.</p></main><nav className="fresh-bottom"><Link href="/driver-pwa-fresh/visual-preview/workflow?tab=jobs">Jobs</Link><Link href="/driver-pwa-fresh/visual-preview/workflow?tab=quotes">Quotes</Link><Link href="/driver-pwa-fresh/visual-preview/workflow?tab=bookings">Bookings</Link></nav></>;
}
