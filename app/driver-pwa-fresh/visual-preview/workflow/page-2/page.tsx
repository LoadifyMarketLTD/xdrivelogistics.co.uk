'use client';

import dynamic from 'next/dynamic';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import OnMyWayToPickupStep from '../../../bookings/[id]/workflow/OnMyWayToPickupStep';
import { FreshBottom } from '../../../FreshNavigation';

const BookingRouteMap=dynamic(()=>import('../../../BookingRouteMap'),{ssr:false});

export default function OnMyWayToPickupPreviewPage(){
  const router=useRouter();
  const [gpsSuggestion,setGpsSuggestion]=useState(false);
  return <main className="fresh-driver-pwa">
    <div style={{padding:'8px 12px 0',textAlign:'right'}}><button type="button" onClick={()=>setGpsSuggestion(v=>!v)} style={{fontSize:12,color:'#0b2f6b',border:'1px solid #cbd5e1',borderRadius:6,background:'#fff',padding:'7px 10px'}}>{gpsSuggestion?'Reset GPS simulation':'Preview GPS arrival suggestion'}</button></div>
    <OnMyWayToPickupStep
      bookingReference="XDL-2026-00128"
      routeLabel="Blackburn BB1 → Manchester M2"
      agreedRate="£240.00"
      paymentTerms="30 Days EOM"
      map={<BookingRouteMap pickup="BB1 2BB" delivery="M2 2AB" focus="pickup"/>}
      address="Unit 4, Logistics Park, Blackburn BB1 2BB"
      schedule="28 Oct · 09:00–10:00"
      contactName="John Smith"
      phone="+44 7700 900123"
      instructions="Report to gate 1. Forklift available."
      gpsSuggestion={gpsSuggestion}
      onBack={()=>history.back()}
      onNext={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-3')}
    />
    <FreshBottom active="bookings" demo />
  </main>;
}
