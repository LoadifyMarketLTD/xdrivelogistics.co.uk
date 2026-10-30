'use client';

import dynamic from 'next/dynamic';
import OnMyWayToPickupStep from '../../../bookings/[id]/workflow/OnMyWayToPickupStep';
import { FreshBottom } from '../../../FreshNavigation';

const BookingRouteMap=dynamic(()=>import('../../../BookingRouteMap'),{ssr:false});

export default function OnMyWayToPickupPreviewPage(){
  return <main className="fresh-driver-pwa">
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
      navigateHref="#"
      onBack={()=>history.back()}
      onNext={()=>undefined}
    />
    <FreshBottom active="bookings" demo />
  </main>;
}
