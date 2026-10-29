/** Approved 11-screen visual journey, derived only from persisted booking state. */
export function driverBookingScreen(status:string, podComplete:boolean, invoiceStatus?:string|null,paymentStatus?:string|null):{number:number;title:string} {
  const invoice=(invoiceStatus||'').trim().toLowerCase();
  const payment=(paymentStatus||'').trim().toLowerCase();
  if(podComplete && (payment==='paid'||payment==='partially_paid'||payment==='overdue'))return {number:11,title:'Invoice Sent / Payment Tracking'};
  if(podComplete && (invoice==='sent'||invoice==='paid'||invoice==='partially_paid'||invoice==='overdue')) return {number:11,title:'Invoice Sent / Payment Tracking'};
  if(podComplete && invoice==='issued') return {number:10,title:'Invoice Issued'};
  if(podComplete && invoice==='draft') return {number:9,title:'Invoice Draft'};
  if(podComplete) return {number:8,title:'POD Recorded'};
  const stage:Record<string,{number:number;title:string}>={
    on_my_way:{number:2,title:'On My Way to Pickup'},
    on_site_pickup:{number:3,title:'On Site at Pickup'},
    loaded:{number:4,title:'Loaded / Collected'},
    in_transit:{number:5,title:'In Transit to Delivery'},
    on_site_delivery:{number:6,title:'On Site at Delivery'},
    delivered:{number:7,title:'Proof of Delivery (POD)'},
    completed:{number:7,title:'Proof of Delivery (POD)'}
  };
  return stage[status]||{number:1,title:'Job Awarded / Booking Details'};
}
