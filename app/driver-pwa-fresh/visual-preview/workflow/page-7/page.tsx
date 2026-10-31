'use client';

import { useRef, useState } from 'react';
import {useRouter} from 'next/navigation';
import {useRouter} from 'next/navigation';
import ProofOfDeliveryStep from '../../../bookings/[id]/workflow/ProofOfDeliveryStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function ProofOfDeliveryPreviewPage(){
 const router=useRouter();
 const signatureRef=useRef<HTMLCanvasElement>(null);
 const [status,setStatus]=useState('Completed Delivery');
 const [items,setItems]=useState('2');
 const [weight,setWeight]=useState('640');
 const [recipient,setRecipient]=useState('E2E Recipient');
 const [leftAt,setLeftAt]=useState('Reception');
 const [date,setDate]=useState('2026-10-28');
 const [notes,setNotes]=useState('All goods delivered in good condition.');
 return <main className="fresh-driver-pwa">
  <ProofOfDeliveryStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   deliveryConfirmed deliveryStatus={status} itemCount={items} weight={weight}
   photoPaths={['photo-1','photo-2']} photoUrls={[]} documentPaths={['pod-document.pdf']}
   recipientName={recipient} leftAt={leftAt} deliveredOn={date} notes={notes} signatureRef={signatureRef} signatureReady
   hardCopyRequired={false} hardCopyAcknowledged={false} draftLoaded draftSaving={false}
   onBack={()=>history.back()} onDeliveryStatus={setStatus} onItemCount={setItems} onWeight={setWeight}
   onRecipientName={setRecipient} onLeftAt={setLeftAt} onDeliveredOn={setDate} onNotes={setNotes}
   onPhotos={()=>undefined} onDocuments={()=>undefined} onSignatureStart={()=>undefined} onSignatureMove={()=>undefined} onSignatureEnd={()=>undefined}
   onSaveSignature={()=>undefined} onClearSignature={()=>undefined} onHardCopyAcknowledged={()=>undefined} onSaveDraft={()=>undefined} onSubmit={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-8')}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
