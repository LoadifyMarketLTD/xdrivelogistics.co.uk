'use client';

import {useRouter} from 'next/navigation';
import PodRecordedStep from '../../../bookings/[id]/workflow/PodRecordedStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function PodRecordedPreviewPage(){
 const router=useRouter();
 return <main className="fresh-driver-pwa">
  <PodRecordedStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   generatedAt="28 Oct 2026, 16:55" receiverName="E2E Recipient" leftAt="Reception" itemCount={2} weight="640 kg" photoCount={2} signatureRecorded
   notes="All goods delivered in good condition." canCreateInvoice
   onBack={()=>history.back()} onViewPdf={()=>undefined} onCreateInvoice={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-9')}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
