'use client';

import InvoiceDraftStep from '../../../bookings/[id]/workflow/InvoiceDraftStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function InvoiceDraftPreviewPage(){
 return <main className="fresh-driver-pwa">
  <InvoiceDraftStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" invoiceNumber="INV-2026-00456"
   clientName="E2E Collection" customerXdId="XD12345" issuerName="XDrive Logistics" issuerXdId="XD67890" jobRef="XDL-2026-00128"
   netAmount="£240.00" vatRate={20} vatAmount="£48.00" totalAmount="£288.00" paymentTerms="30 Days EOM"
   invoiceDate="28 Oct 2026" dueDate="27 Nov 2026" serviceDescription="Transport services as per booking."
   onBack={()=>history.back()} onPreview={()=>undefined} onEdit={()=>undefined} onReview={()=>undefined}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
