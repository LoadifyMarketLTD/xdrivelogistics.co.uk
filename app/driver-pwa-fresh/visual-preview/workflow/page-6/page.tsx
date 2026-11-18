'use client';

import { useState } from 'react';
import {useRouter} from 'next/navigation';
import OnSiteDeliveryStep from '../../../bookings/[id]/workflow/OnSiteDeliveryStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function OnSiteDeliveryPreviewPage(){
 const router=useRouter();
 const [items,setItems]=useState('2');
 const [weight,setWeight]=useState('640');
 const [notes,setNotes]=useState('Delivered to reception.');
 return <main className="fresh-driver-pwa">
  <OnSiteDeliveryStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   address="Industrial Estate, Manchester M2 2AB" schedule="28 Oct · ASAP" contactName="Sarah Brown" phone="+44 7700 112233"
   itemCount={items} weight={weight} photoPaths={['photo-1','photo-2','photo-3']} photoUrls={[]} notes={notes}
   draftLoaded draftSaving={false} working={false}
   onBack={()=>history.back()} onItemCount={setItems} onWeight={setWeight} onNotes={setNotes} onPhotos={()=>undefined} onConfirm={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-7')}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
