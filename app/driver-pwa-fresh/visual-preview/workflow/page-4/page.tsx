'use client';

import LoadedCollectedStep from '../../../bookings/[id]/workflow/LoadedCollectedStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function LoadedCollectedPreviewPage(){
 return <main className="fresh-driver-pwa">
  <LoadedCollectedStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   confirmedAt="28 Oct 2026, 10:12" driverName="Driver Name"
   collectedRows={[{label:'Items',value:'2'},{label:'Weight',value:'640 kg'}]}
   photoCount={4} documentCount={1} notes="All goods loaded and secured. No damage observed."
   onBack={()=>history.back()} onNext={()=>undefined}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
