'use client';

import {useRouter} from 'next/navigation';
import BookingDetailsStep from '../../../bookings/[id]/workflow/BookingDetailsStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function BookingDetailsPreviewPage(){
  const router=useRouter();
  return <main className="fresh-driver-pwa">
    <BookingDetailsStep
      bookingReference="XDL-2026-00128"
      routeLabel="Blackburn BB1 → Manchester M2"
      statusLabel="Accepted"
      agreedRate="£240.00"
      paymentTerms="30 Days EOM"
      customerName="E2E Collection"
      memberCode="XD12345"
      memberPhone="+44 7700 900123"
      stops={[
        {key:'collection',label:'Collection',address:'Unit 4, Logistics Park, Blackburn BB1 2BB',schedule:'28 Oct · 09:00–10:00',contactName:'John Smith',phone:'+44 7700 900123',navigateHref:'https://www.google.com/maps/dir/?api=1&destination=Unit%204%20Logistics%20Park%20Blackburn%20BB1%202BB&travelmode=driving'},
        {key:'delivery',label:'Delivery',address:'Industrial Estate, Manchester M2 2AB',schedule:'28 Oct · ASAP',contactName:'Sarah Brown',phone:'+44 7700 112233',navigateHref:'https://www.google.com/maps/dir/?api=1&destination=Industrial%20Estate%20Manchester%20M2%202AB&travelmode=driving'},
      ]}
      onBack={()=>history.back()}
      onMessage={()=>undefined}
      onNext={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-2')}
    />
    <FreshBottom active="bookings" demo />
  </main>;
}
