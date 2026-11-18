'use client';
import {useRouter} from 'next/navigation';
import InvoiceIssuedStep from '../../../bookings/[id]/workflow/InvoiceIssuedStep';
import {FreshBottom} from '../../../FreshNavigation';
export default function Preview(){
 const router=useRouter();
 return <main className="fresh-driver-pwa">
  <InvoiceIssuedStep bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2"
   invoiceNumber="INV-2026-00456" clientName="E2E Collection"
   totalAmount="£288.00" dueDate="27 Nov 2026" paymentTerms="30 Days EOM"
   issuerName="XDrive Logistics" invoiceDate="28 Oct 2026" invoiceStatus="Issued"
   onBack={()=>history.back()} onPreview={()=>undefined} onReviewAndSend={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-11')}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
