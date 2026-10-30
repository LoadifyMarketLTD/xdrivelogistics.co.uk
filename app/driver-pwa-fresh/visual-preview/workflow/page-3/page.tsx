'use client';

import { useState } from 'react';
import OnSitePickupStep from '../../../bookings/[id]/workflow/OnSitePickupStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function OnSitePickupPreviewPage(){
 const [items,setItems]=useState('2');
 const [condition,setCondition]=useState('Good');
 const [discrepancy,setDiscrepancy]=useState('');
 const [notes,setNotes]=useState('Goods in good condition.');
 return <main className="fresh-driver-pwa">
  <OnSitePickupStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   cargoRows={[{label:'Items',value:'2'},{label:'Pallets',value:'2'},{label:'Weight',value:'640 kg'},{label:'Dimensions',value:'120 × 80 × 100 cm'},{label:'Cargo type',value:'Palletised goods'},{label:'Value',value:'£1,200'},{label:'Handling / Requirements',value:'Forklift'}]}
   collectionPhotoCount={0} collectionDocumentCount={0} actualItems={items} condition={condition} discrepancy={discrepancy} notes={notes}
   onBack={()=>history.back()} onActualItems={setItems} onCondition={setCondition} onDiscrepancy={setDiscrepancy} onNotes={setNotes}
   onPhotos={()=>undefined} onDocuments={()=>undefined} onConfirmLoaded={()=>undefined}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
