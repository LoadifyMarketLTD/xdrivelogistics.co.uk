"use client";
import type {DemoLoad} from "./demoExchange";

/** Never synthesize a financial document from a booking or POD. */
export default function DemoInvoicePreview({booking}:{booking:DemoLoad}){
 if(!booking.podReceived)return null;
 return <section className="panel" aria-label="Invoice status">
  <h3>Invoice</h3>
  <p role="status">No issued invoice is associated with this booking. Invoice information will appear only when an actual invoice record is available.</p>
 </section>;
}
