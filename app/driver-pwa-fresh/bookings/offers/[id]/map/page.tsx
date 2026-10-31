'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {useParams,useRouter} from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import {readRouteAuthAccessToken} from '../../../../../../lib/routeAuthCookie';
import {FreshBottom,FreshHeader} from '../../../../FreshNavigation';
const MarketplaceLoadMap=dynamic(()=>import('../../../../../components/workspace/MarketplaceLoadMap'),{ssr:false});

type Offer={id:string;job_id:string;buyer_name:string;public_reference:string|null;job:{pickup_city:string|null;pickup_location:string|null;pickup_postcode:string|null;delivery_city:string|null;delivery_location:string|null;delivery_postcode:string|null;pickup_datetime:string|null;requested_vehicle_label:string|null;vehicle_type:string|null}|null};
export default function BookingOfferMap(){
 const params=useParams<{id:string}>();const router=useRouter();const id=typeof params?.id==='string'?params.id:'';
 const [offer,setOffer]=useState<Offer|null>(null),[error,setError]=useState('');
 useEffect(()=>{void(async()=>{try{const token=await readRouteAuthAccessToken();if(!token)throw new Error('Please sign in again.');const response=await fetch('/api/booking-offers',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const body=await response.json() as {offers?:Offer[];error?:string};if(!response.ok)throw new Error(body.error||'Map could not be loaded.');const found=(body.offers||[]).find(item=>item.id===id)||null;if(!found)throw new Error('Booking offer not found.');setOffer(found)}catch(e){setError(e instanceof Error?e.message:'Map could not be loaded.')}})()},[id]);
 const job=offer?.job;
 const pickup=[job?.pickup_city||job?.pickup_location,job?.pickup_postcode].filter(Boolean).join(', ');
 const delivery=[job?.delivery_city||job?.delivery_location,job?.delivery_postcode].filter(Boolean).join(', ');
 return <ProtectedRoute allowedRoles={['driver']}><FreshHeader title="Map"/><main className="fresh-content">{error?<p className="fresh-message fresh-error">{error}</p>:offer&&job?<MarketplaceLoadMap loads={[{id:offer.job_id,pickupLabel:pickup,pickupPostcode:job.pickup_postcode,deliveryLabel:delivery,deliveryPostcode:job.delivery_postcode,vehicleLabel:job.requested_vehicle_label||job.vehicle_type||'Vehicle',posterName:offer.buyer_name,pickupAt:job.pickup_datetime,postedAt:null}]} onDetails={()=>router.push('/driver-pwa-fresh/bookings/offers/'+encodeURIComponent(id))}/>:<p className="fresh-message">Loading map...</p>}</main><FreshBottom active="bookings"/></ProtectedRoute>
}
