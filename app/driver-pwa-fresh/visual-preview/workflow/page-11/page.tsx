'use client';
import InvoicePaymentTrackingStep from '../../../bookings/[id]/workflow/InvoicePaymentTrackingStep';
import {FreshBottom} from '../../../FreshNavigation';
export default function Preview(){
 return <main className="fresh-driver-pwa">
  <InvoicePaymentTrackingStep bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2"
   invoiceNumber="INV-2026-00456" clientName="E2E Collection"
   totalAmount="£288.00" dueDate="27 Nov 2026" paymentTerms="30 Days EOM"
   invoiceStatus="Sent" paymentStatus="Awaiting Payment"
   onBack={()=>history.back()} onPreview={()=>undefined} onViewInvoice={()=>undefined}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
