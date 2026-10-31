'use client';

import {useRouter} from 'next/navigation';
import LoadedCollectedStep from '../../../bookings/[id]/workflow/LoadedCollectedStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function LoadedCollectedPreviewPage(){
 const router=useRouter();
 return <main className="fresh-driver-pwa">
  <LoadedCollectedStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   confirmedAt="28 Oct 2026, 10:12" driverName="Driver Name"
   collectedRows={[{label:'Items',value:'2'},{label:'Weight',value:'640 kg'}]}
   photoCount={4} documentCount={1} notes="All goods loaded and secured. No damage observed."
   nextStopAddress="Industrial Estate, Manchester M2 2AB" nextStopSchedule="28 Oct · ASAP" nextStopContact="Sarah Brown" nextStopPhone="+44 7700 112233"
   onBack={()=>history.back()} onNext={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-5')}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
