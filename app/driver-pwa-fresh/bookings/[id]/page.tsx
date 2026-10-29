'use client';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverJobExecutionPage from '../../../components/workspace/DriverJobExecutionPage';
import {FreshBottom} from '../../FreshNavigation';

// Keep the existing, authorised booking lifecycle, POD and invoice implementation.
// Present it inside the mobile driver shell rather than routing into desktop navigation.
export default function FreshBookingDetail(){
 const params=useParams<{id:string}>();
 const id=typeof params?.id==='string'?params.id:'';
 return <ProtectedRoute allowedRoles={['driver']}>
  <header className="fresh-booking-detail-header"><Link href="/driver-pwa-fresh/bookings" aria-label="Back to bookings">‹ Back</Link><strong>Booking details &amp; actions</strong></header>
  <main className="fresh-booking-execution">{id?<DriverJobExecutionPage jobId={id} mobilePwa/>:<p>Booking reference missing.</p>}</main>
  <FreshBottom active="bookings"/>
 </ProtectedRoute>;
}
