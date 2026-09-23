(function(){
 const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const query=new URLSearchParams(location.search),selectedId=query.get('job'),detailOrigin=query.get('from')||'';
 let detailSnapshot=null;
 if(['detail.html','quote-form.html','booking-detail.html'].includes(path)&&selectedId){
  try{
   const parentSnapshot=window.parent&&window.parent!==window&&window.parent.XDriveTabs&&typeof window.parent.XDriveTabs.getDetailSnapshot==='function'?window.parent.XDriveTabs.getDetailSnapshot(selectedId):null;
   if(parentSnapshot&&String(parentSnapshot.jobId||'')===String(selectedId)&&Date.now()-Number(parentSnapshot.at||0)<120000)detailSnapshot=parentSnapshot;
  }catch(_e){}
  if(!detailSnapshot){try{const raw=JSON.parse(localStorage.getItem('xdrive-detail-snapshot-v1')||'null');if(raw&&String(raw.jobId||'')===String(selectedId)&&Date.now()-Number(raw.at||0)<120000)detailSnapshot=raw}catch(_e){}}
 }
 function parse(raw){try{return JSON.parse(raw||'{}')}catch{return {status:500,body:{error:'Invalid native response.'}}}}
 function call(url){
  if(!window.XDriveNative||typeof XDriveNative.apiGet!=='function')return null;
  const getter=typeof XDriveNative.apiGetCached==='function'?XDriveNative.apiGetCached.bind(XDriveNative):XDriveNative.apiGet.bind(XDriveNative);
  const r=parse(getter(url));
  if(Number(r.status)===401){location.replace('login.html');return null}
  if(Number(r.status)<200||Number(r.status)>=300){console.error('XDrive API',url,r.body);return null}
  return r.body||{};
 } function batch(urls){
  const list=[...new Set((urls||[]).filter(Boolean))];
  if(!list.length)return {};
  if(!window.XDriveNative||typeof XDriveNative.apiBatchGet!=='function')return Object.fromEntries(list.map(u=>[u,call(u)]));
  const outer=parse(XDriveNative.apiBatchGet(JSON.stringify(list)));
  if(Number(outer.status)===401){location.replace('login.html');return {}}
  if(Number(outer.status)<200||Number(outer.status)>=300){console.error('XDrive batch API',outer.body);return Object.fromEntries(list.map(u=>[u,call(u)]))}
  const wrapped=outer.body&&outer.body.responses&&typeof outer.body.responses==='object'?outer.body.responses:{};
  const out={};
  for(const u of list){
   const r=wrapped[u]||{status:500,body:{error:'Missing batch response.'}};
   if(Number(r.status)===401){location.replace('login.html');out[u]=null;continue}
   if(Number(r.status)<200||Number(r.status)>=300){console.error('XDrive API',u,r.body);out[u]=null;continue}
   out[u]=r.body||{};
  }
  return out;
 }
 const fastJobContext=['detail.html','quote-form.html','booking-detail.html'].includes(path)&&detailSnapshot&&detailSnapshot.job;
 const rb=fastJobContext?{resources:{}}:call('/api/driver/mobile/resources');
 if(!rb){window.XDRIVE_REAL={profile:null,vehicle:null,documents:[],jobs:[],bookings:[],quotes:[],invoices:[],alerts:[]};window.XDRIVE_REAL_JOBS=[];return}
 const r=rb.resources||{},rp=r.profile||{},rd=r.driver||{},rv=r.vehicle||{},co=r.company||{};
 const identity=String(rp.driver_id||rd.id||r.email||'');
 const old=localStorage.getItem('xdrive-live-identity')||'';
 if(identity&&old&&old!==identity){['xdrive-profile','xdrive-vehicle','xdrive-documents','xdrive-invoices','xdrive-prototype-workflow-v1','xdrive-load-states'].forEach(k=>localStorage.removeItem(k));sessionStorage.clear()}
 if(identity)localStorage.setItem('xdrive-live-identity',identity);
 const profile={driverId:String(rp.driver_id||rd.id||''),companyId:rp.company_id||rd.company_id||null,name:String(r.name||rp.display_name||rd.display_name||r.email||'Driver'),email:String(r.email||rp.email||rd.email||''),phone:String(r.phone||rd.phone||''),role:'driver',status:String(rd.status||'active'),availabilityStatus:String(rd.availability_status||''),driverType:String(rd.driver_type||''),canCommercialBid:rd.can_commercial_bid===true,companyName:String(co.name||''),companyXdId:String(co.xd_id||'')};
 const vehicle=rv&&rv.id?{id:String(rv.id),make:String(rv.make||''),model:String(rv.model||''),type:String(rv.type||'Vehicle').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),rawType:String(rv.type||''),registration:String(rv.reg_plate||''),status:String(rv.status||'Available'),available:!['unavailable','inactive','off_road'].includes(String(rv.status||'').toLowerCase()),tailLift:/tail.?lift/i.test(String(rv.type||''))}:null;
 const documents=(r.documents||[]).map(d=>({id:String(d.id||''),type:String(d.doc_type||'Document'),status:String(d.status||''),issued:String(d.issued_date||''),createdAt:String(d.created_at||''),expires:String(d.expiry_date||''),isVehicleDocument:d.is_vehicle_document===true,rejectionReason:String(d.rejection_reason||''),riskStatus:String(d.risk_status||''),verifiedAt:String(d.verified_at||'')}));
 const invoices=(r.invoices||[]).map(i=>({id:String(i.id||''),number:String(i.invoice_number||i.id||''),isTest:false,jobId:String(i.job_id||''),client:String(i.client_name||i.company_name||'Client'),clientAddress:String(i.client_address||''),clientEmail:String(i.client_email||''),amount:Number(i.total??i.amount??0),netAmount:Number(i.net_amount??i.subtotal??i.amount??0),vatAmount:Number(i.vat_amount??0),vatRate:Number(i.vat_rate??0),currency:String(i.currency||'GBP'),status:String(i.status||''),payment:String(i.payment_status||''),due:String(i.due_date||''),invoiceDate:String(i.invoice_date||i.issue_date||i.created_at||''),date:String(i.created_at||''),terms:String(i.payment_terms||''),jobRef:String(i.job_ref||i.job_reference||''),loadId:String(i.load_id||''),customerRef:String(i.customer_ref||''),vehicleType:String(i.vehicle_type||''),vehicleRegistration:String(i.vehicle_registration||''),orderedAt:String(i.ordered_at||''),deliveredAt:String(i.delivered_at||''),pickupLocation:String(i.pickup_location||''),pickupDateTime:String(i.pickup_datetime||''),deliveryLocation:String(i.delivery_location||''),deliveryDateTime:String(i.delivery_datetime||''),deliveryRecipient:String(i.delivery_recipient||i.recipient_name||''),leftAt:String(i.left_at||''),noOfItems:i.no_of_items==null?null:Number(i.no_of_items),deliveryNotes:String(i.delivery_notes||''),cargoSummary:String(i.cargo_summary||''),serviceDescription:String(i.service_description||'Transport service'),podGenerated:i.pod_generated===true,podDeliveryStatus:String(i.pod_delivery_status_snapshot||''),issuerName:String(i.issuer_name_snapshot||''),issuerAddress:String(i.issuer_address_snapshot||''),issuerCompanyNumber:String(i.issuer_company_number_snapshot||''),issuerVatNumber:String(i.issuer_vat_number_snapshot||''),issuerXdId:String(i.issuer_xd_id_snapshot||''),issuerEmail:String(i.issuer_email_snapshot||''),issuerPhone:String(i.issuer_phone_snapshot||''),customerCompanyNumber:String(i.customer_company_number_snapshot||''),customerVatNumber:String(i.customer_vat_number_snapshot||''),customerXdId:String(i.customer_xd_id_snapshot||''),bankAccountName:String(i.bank_account_name_snapshot||''),bankSortCode:String(i.bank_sort_code_snapshot||''),bankAccountNumber:String(i.bank_account_number_snapshot||'')}));
 const R={profile,vehicle,documents,invoices,alerts:r.alerts||[],operationalEventLog:r.operational_event_log||[],jobs:[],bookings:[],quotes:[],returnJourney:r.return_journey||null};
 const pc=v=>{const raw=String(v||'').trim().toUpperCase(),m=raw.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);return (m?m[1]:raw).replace(/\s+/g,'')};
 const cleanLocation=v=>{const s=String(v||'').trim(),p=s.split(',').map(x=>x.trim()).filter(Boolean);if(p.length===2&&p[0].replace(/\s+/g,'').toUpperCase()===p[1].replace(/\s+/g,'').toUpperCase())return p[0];return s};
 const text=v=>typeof v==='string'?v.trim():'';
 function parseLoadDetails(value){
  if(value&&typeof value==='object'&&!Array.isArray(value))return value;
  const raw=text(value);if(!raw||raw[0]!=='{')return{};
  try{const o=JSON.parse(raw);return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(_e){return{}}
 }
 function cleanDriverNotes(j,details){
  const parts=[];
  const looksStructured=s=>/^\s*[\{\[]/.test(s)||/"(?:createdFrom|references|collection|delivery|customerReference|purchaseOrderNumber|bookingReference|timeSlot|postcode|address|contactName|contactPhone|forkliftAvailable|tailLiftRequired|handballRequired|dimensionsCm|palletDetails|documentChecklist)"\s*:/.test(s);
  const add=v=>{const s=text(v);if(s&&!looksStructured(s)&&!parts.includes(s))parts.push(s)};
  add(details.publicQuoteNotes);add(details.executionInstructions);add(details.notes);add(j.loadNotes||j.load_notes);add(j.specialInstructions);
  String(j.requirements||'').split(/\r?\n/).forEach(line=>add(line));
  if(!parts.length)add(j.notes);
  return parts.join(' · ');
 }
 function dimensionsFrom(j,details){
  const d=(details&&details.dimensionsCm&&typeof details.dimensionsCm==='object')?details.dimensionsCm:{};
  const length=Number(d.length??j.lengthCm??j.length_cm),width=Number(d.width??j.widthCm??j.width_cm),height=Number(d.height??j.heightCm??j.height_cm);
  return [length,width,height].every(n=>Number.isFinite(n)&&n>0)?{length,width,height}:null;
 }
 function mapNearby(j){
  const p=j.pickup||{},d=j.delivery||{},poster=j.poster||{};
  const dim=j.dimensionsCm&&typeof j.dimensionsCm==='object'?j.dimensionsCm:null;
  const dimensions=dim&&Number(dim.length)>0&&Number(dim.width)>0&&Number(dim.height)>0?{length:Number(dim.length),width:Number(dim.width),height:Number(dim.height)}:null;
  return{id:String(j.id||''),ref:String(j.publicReference||j.reference||j.jobReference||j.id||''),isTest:false,company:String(j.posterCompanyName||j.companyName||j.clientName||poster.companyName||poster.name||'Company not supplied'),companyXdId:String(j.companyXdId||poster.xdId||poster.companyXdId||poster.memberCode||''),companyId:j.posterCompanyId||j.companyId||j.company_id||null,memberType:String(poster.memberType||''),memberSince:poster.memberSince||null,vehicle:String(j.requestedVehicleLabel||j.vehicleRequirement||j.vehicleType||j.requestedVehicleType||j.vehicle?.type||'Vehicle not supplied'),bodyType:String(j.bodyType||''),pallets:j.pallets??j.palletCount??j.cargo?.pallets??j.cargo?.palletCount??null,weight:j.weightKg??j.weight??j.cargo?.weightKg??j.cargo?.weight??null,dimensions,requirementFlags:Array.isArray(j.requirementFlags)?j.requirementFlags.map(String):[],pickupLocation:String(p.addressSummary||p.address||p.postcode||''),pickupPostcode:pc(p.postcode||p.addressSummary||p.address),deliveryLocation:String(d.addressSummary||d.address||d.postcode||''),deliveryPostcode:pc(d.postcode||d.addressSummary||d.address),collectionStart:p.collectionFrom||p.collection_from||p.from||j.collectionFrom||j.collection_from||null,collectionEnd:p.collectionTo||p.collection_to||p.to||j.collectionTo||j.collection_to||p.collectionFrom||p.collection_from||null,deliveryStart:d.deliveryFrom||d.delivery_from||d.from||j.deliveryFrom||j.delivery_from||null,deliveryEnd:d.deliveryTo||d.delivery_to||d.to||j.deliveryTo||j.delivery_to||d.deliveryFrom||d.delivery_from||null,paymentTerms:String(j.paymentTerms||j.payment_terms||''),postedAt:j.postedAt||j.posted_at||j.createdAt||j.created_at||j.publishedAt||j.published_at||null,status:String(j.status||'posted'),distanceMiles:(()=>{const n=Number(j.distanceToPickupMiles??j.distanceMiles);return Number.isFinite(n)&&n>=0&&n<=700?n:null})(),pickupEtaMinutes:(()=>{const n=Number(j.pickupEtaMinutes);return Number.isFinite(n)&&n>0?n:null})(),distanceOrigin:String(j.distanceOrigin||''),journeyDistanceMiles:j.journeyDistanceMiles??null,estimatedJourneyMinutes:j.estimatedJourneyMinutes??null,freightType:String(j.freightType||''),notes:String(j.notesSummary||''),serviceMode:String(j.serviceMode||''),directDeliveryRequired:j.directDeliveryRequired===true,hasProposedPrice:j.hasProposedPrice===true,proposedPriceGbp:j.proposedPriceGbp==null?null:Number(j.proposedPriceGbp),canQuote:j.canQuote!==false,preferenceState:j.preferenceState||null};
 }
 function mapBooking(j){
  const details=parseLoadDetails(j.loadDetails||j.load_details),dimensions=dimensionsFrom(j,details),notes=cleanDriverNotes(j,details);
  return{id:String(j.id||''),ref:String(j.reference||j.publicReference||j.jobReference||j.id||''),isTest:false,company:String(j.clientName||j.companyName||j.posterCompanyName||'Company not supplied'),companyXdId:String(j.companyXdId||j.clientXdId||''),companyId:j.companyId||j.company_id||j.posterCompanyId||null,customerRef:j.customerReference||j.customerRef||null,vehicle:String(j.requestedVehicleLabel||j.vehicleRequirement||j.vehicleType||j.requestedVehicleType||'Vehicle not supplied'),bodyType:String(j.bodyType||j.vehicleBodyType||''),requirementFlags:Array.isArray(j.requirementFlags)?j.requirementFlags.map(String):[],pallets:j.pallets??j.palletCount??j.cargo?.pallets??j.cargo?.palletCount??null,weight:j.weightKg??j.weight??j.cargo?.weightKg??j.cargo?.weight??null,freightType:String(j.freightType||j.cargoType||j.requestedCargoLabel||''),dimensions,publicQuoteNotes:text(details.publicQuoteNotes),executionInstructions:text(details.executionInstructions||j.loadNotes||j.load_notes),loadNotes:String(j.loadNotes||j.load_notes||''),pickupLocation:cleanLocation(j.pickupLocation||j.pickupAddress||''),pickupPostcode:pc(j.pickupPostcode||j.pickupLocation||j.pickupAddress),deliveryLocation:cleanLocation(j.deliveryLocation||j.deliveryAddress||''),deliveryPostcode:pc(j.deliveryPostcode||j.deliveryLocation||j.deliveryAddress),collectionStart:j.pickupTime||j.collectionStart||j.collection_from||null,collectionEnd:j.pickupEndTime||j.collectionEnd||j.collection_to||j.pickupTime||j.collectionStart||null,deliveryStart:j.deliveryTime||j.deliveryStart||j.delivery_from||null,deliveryEnd:j.deliveryEndTime||j.deliveryEnd||j.delivery_to||j.deliveryTime||j.deliveryStart||null,paymentTerms:String(j.paymentTerms||j.payment_terms||''),agreedRateAmount:(()=>{const n=Number(j.agreedRateAmount??j.budgetAmount);return Number.isFinite(n)&&n>0?n:null})(),priceLabel:String(j.price||''),tailLift:j.tailLift===true,forkliftAvailable:j.forkliftAvailable===true,handballRequired:j.handballRequired===true,adr:j.adr===true,temperatureControlled:j.temperatureControlled===true,operationalBadges:Array.isArray(j.badges)?j.badges.map(String):[],customerReference:String(j.customerReference||j.customerRef||''),internalReference:String(j.internalReference||''),status:String(j.status||j.currentStatus||j.lifecycleStatus||''),currentStatus:String(j.currentStatus||''),lifecycleStatus:String(j.lifecycleStatus||''),podGenerated:!!(j.podGenerated||j.pod_generated),podCompleted:j.podCompleted===true||j.podGenerated===true||j.pod_generated===true||(Array.isArray(j.deliveryPhotos)&&j.deliveryPhotos.length>0)||(Array.isArray(j.delivery_photos)&&j.delivery_photos.length>0)||(Array.isArray(j.podPhotos)&&j.podPhotos.length>0)||(Array.isArray(j.pod_photos)&&j.pod_photos.length>0)||Boolean(j.deliverySignatureData||j.delivery_signature_data),itemCount:j.itemCount??j.no_of_items??null,packaging:String(j.packaging||''),weightKg:j.weightKg??j.weight_kg??null,collectionNotes:String(j.collectionNotes||j.collection_notes||''),pickupPhotos:Array.isArray(j.pickupPhotos)?j.pickupPhotos:(Array.isArray(j.pickup_photos)?j.pickup_photos:[]),collectionHandover:j.collectionHandover||j.collection_handover||null,statusHistory:Array.isArray(j.statusHistory)&&j.statusHistory.length?j.statusHistory:((j.pod&&Array.isArray(j.pod.auditHistory))?j.pod.auditHistory:[]),distanceMiles:j.distanceToPickupMiles??null,pickupEtaMinutes:j.pickupEtaMinutes??null,journeyDistanceMiles:j.journeyDistanceMiles??j.jobDistanceMiles??j.job_distance_miles??j.distanceMiles??null,estimatedJourneyMinutes:j.estimatedJourneyMinutes??j.jobDistanceMinutes??j.job_distance_minutes??null,notes,pod:j.pod||null,hardCopyPod:String(j.hardCopyPod||j.hard_copy_pod||''),collectionPassRequired:j.collectionPassRequired===true||j.collection_pass_required===true,podDeliveryStatus:String((j.pod&&j.pod.deliveryStatus)||''),podLeftAt:String((j.pod&&j.pod.leftAt)||''),podDeliveredOn:String((j.pod&&j.pod.deliveredOn)||''),podNoOfItems:(j.pod&&j.pod.noOfItems)!=null?Number(j.pod.noOfItems):null,deliveryPhotos:Array.isArray(j.deliveryPhotos)?j.deliveryPhotos:(Array.isArray(j.delivery_photos)?j.delivery_photos:[]),deliverySignatureData:j.deliverySignatureData||j.delivery_signature_data||null,clientSignatureName:String(j.clientSignatureName||j.client_signature_name||''),contactAllowed:j.contactAllowed===true,contactName:String(j.contactName||''),contactPhone:String(j.contactPhone||''),collectionContactName:String(j.collectionContactName||''),collectionContactPhone:String(j.collectionContactPhone||''),deliveryContactName:String(j.deliveryContactName||''),deliveryContactPhone:String(j.deliveryContactPhone||''),clientName:String(j.clientName||j.companyName||''),clientPhone:String(j.clientPhone||j.contactPhone||''),updatedAt:j.updatedAt||j.updated_at||null,attachments:j.attachments||[],stops:Array.isArray(j.stops)?j.stops.map(s=>({id:String(s.id||''),type:String(s.type||s.stopType||''),sequence:Number(s.sequence||0),address:cleanLocation(s.address||s.postcode||''),company:String(s.company||''),contactPerson:String(s.contactPerson||s.contact_name||''),telephone:String(s.telephone||s.contact_phone||''),timeWindowFrom:s.timeWindowFrom||s.windowStart||s.window_start||null,timeWindowTo:s.timeWindowTo||s.windowEnd||s.window_end||null,status:String(s.status||'pending'),notes:String(s.notes||s.instructions||''),arrivedAt:s.arrivedAt||s.arrived_at||null,completedAt:s.completedAt||s.completed_at||null,handover:s.handover||null})):[]};
 }
 window.XDriveMapBooking=mapBooking;
 window.XDriveReplaceBookingFromApi=function(raw){
  if(!raw||!raw.id)return null;
  const mapped=mapBooking(raw),idx=(R.bookings||[]).findIndex(x=>String(x.id)===String(mapped.id));
  if(idx>=0)R.bookings[idx]=mapped;else R.bookings.push(mapped);
  window.XDRIVE_REAL=R;
  return mapped;
 };

 function mapBid(q){
  return{id:String(q.id||''),jobId:String(q.jobId||q.job_id||''),jobRef:String(q.jobReference||q.job_reference||q.publicReference||q.jobId||q.job_id||''),company:String(q.companyName||q.clientName||q.posterCompanyName||q.company?.name||''),companyXdId:String(q.companyXdId||q.company?.xdId||''),amount:Number(q.amount||q.quoteAmount||0),baseAmount:q.baseAmount==null?null:Number(q.baseAmount),additionalExtrasGbp:Number(q.additionalExtrasGbp||0),collectWithinMinutes:q.collectWithinMinutes==null?null:Number(q.collectWithinMinutes),message:String(q.message||''),status:String(q.status||'submitted'),createdAt:q.createdAt||q.created_at||q.submittedAt||q.submitted_at||null,vehicle:String(q.quotedVehicleType||q.requestedVehicleLabel||q.vehicleRequirement||q.vehicleType||''),pickupPostcode:pc(q.pickupPostcode||q.pickup?.postcode||q.pickupLocation),deliveryPostcode:pc(q.deliveryPostcode||q.delivery?.postcode||q.deliveryLocation),paymentTerms:String(q.paymentTerms||q.payment_terms||''),isTest:false};
 }
 const needsLoads=['index.html','alerts.html','return-journey.html'].includes(path)||(path==='quote-form.html'&&!detailSnapshot);
 const needsBookings=['bookings.html','collection-handover.html','collection-pass.html','pod.html','invoice-detail.html','invoices.html'].includes(path)||(path==='booking-detail.html'&&!detailSnapshot);
 const needsQuotes=['quote.html','invoices.html'].includes(path)||(path==='quote-form.html'&&!!query.get('bid')&&!detailSnapshot)||(path==='detail.html'&&detailOrigin==='quotes'&&!detailSnapshot);
 const nearbyUrl='/api/driver/mobile/nearby-jobs?limit=100';
 const upcomingUrl='/api/driver/mobile/jobs?scope=upcoming&limit=100';
 const activeUrl='/api/driver/mobile/jobs?scope=active&limit=100';
 const completedUrl='/api/driver/mobile/jobs?scope=completed&historyDays=365&limit=50';
 const bidsUrl='/api/driver/mobile/bids';
 const detailUrl=selectedId&&['detail.html','booking-detail.html','pod.html','collection-handover.html','collection-pass.html'].includes(path)?((path==='detail.html'&&detailOrigin==='loads')?'/api/driver/mobile/marketplace-jobs/'+encodeURIComponent(selectedId):'/api/driver/mobile/jobs/'+encodeURIComponent(selectedId)):null;
 const bookingPage=path==='bookings.html';
 const historyEnrichmentPage=['invoice-detail.html','invoices.html'].includes(path);
 const bookingAllMode=bookingPage&&new URLSearchParams(location.search).get('tab')==='all';
 const urls=[];
 if(needsLoads)urls.push(nearbyUrl);
 if(needsBookings)urls.push(upcomingUrl,activeUrl);
 if(bookingPage||historyEnrichmentPage)urls.push(completedUrl);
 if(detailUrl)urls.push(detailUrl);
 if(needsQuotes)urls.push(bidsUrl);
 const prefetched=batch(urls);
 if(path==='detail.html'&&detailSnapshot&&detailSnapshot.job){
  R.bookings=[detailSnapshot.job];
  if(detailSnapshot.quote)R.quotes=[detailSnapshot.quote];
 }
 if(path==='quote-form.html'&&detailSnapshot&&detailSnapshot.job){
  R.jobs=[detailSnapshot.job];
  if(detailSnapshot.quote)R.quotes=[detailSnapshot.quote];
 }
 if(path==='booking-detail.html'&&detailSnapshot&&detailSnapshot.job){
  R.bookings=[detailSnapshot.job];
 }
 if(needsLoads){const b=prefetched[nearbyUrl];if(b&&Array.isArray(b.jobs))R.jobs=b.jobs.map(mapNearby)}
 if(needsBookings){
  const u=prefetched[upcomingUrl],a=prefetched[activeUrl],c=(bookingPage||historyEnrichmentPage)?prefetched[completedUrl]:null;
  const rows=[...((u&&u.jobs)||[]),...((a&&a.jobs)||[]),...((c&&c.jobs)||[])],seen=new Set();
  R.bookings=rows.filter(j=>{const id=String(j.id||'');if(!id||seen.has(id))return false;seen.add(id);return true}).map(mapBooking);
  if(detailUrl){
   const detail=prefetched[detailUrl];
   if(detail&&detail.job){const mapped=mapBooking(detail.job),idx=R.bookings.findIndex(j=>j.id===mapped.id||j.ref===mapped.ref);if(idx>=0)R.bookings[idx]=mapped;else R.bookings.unshift(mapped)}
  }
 }
 if(detailUrl){
  const detail=prefetched[detailUrl];
  if(detail&&detail.job){
   const mapped=mapBooking(detail.job),idx=R.bookings.findIndex(j=>String(j.id)===String(mapped.id)||String(j.ref)===String(mapped.ref));
   if(idx>=0)R.bookings[idx]=mapped;else R.bookings.unshift(mapped);
  }
 }
 if(needsQuotes){
  const b=prefetched[bidsUrl];
  if(b&&Array.isArray(b.bids)){
   R.quotes=b.bids.map(mapBid);
   if(path==='quote.html'){
    const known=new Set([...R.jobs,...R.bookings].map(j=>String(j.id||'')));
    const missing=[...new Set(R.quotes.map(q=>String(q.jobId||'')).filter(Boolean))].filter(id=>!known.has(id)).slice(0,20);
    const detailUrls=missing.map(id=>'/api/driver/mobile/jobs/'+encodeURIComponent(id));
    const detailBatch=batch(detailUrls);
    detailUrls.forEach(url=>{
     const detail=detailBatch[url];
     if(detail&&detail.job){const mapped=mapBooking(detail.job);R.bookings.push(mapped);known.add(mapped.id)}
    });
   }
   R.quotes=R.quotes.map(q=>{const j=[...R.jobs,...R.bookings].find(x=>x.id===q.jobId||x.ref===q.jobRef);if(!j)return q;return {...q,jobRef:j.ref||q.jobRef,company:j.company||q.company,companyXdId:j.companyXdId||q.companyXdId,vehicle:j.vehicle||q.vehicle||'Vehicle not supplied',pickupPostcode:j.pickupPostcode||q.pickupPostcode,deliveryPostcode:j.deliveryPostcode||q.deliveryPostcode,paymentTerms:j.paymentTerms||q.paymentTerms,pallets:j.pallets,weight:j.weight,collectionStart:j.collectionStart,collectionEnd:j.collectionEnd,deliveryStart:j.deliveryStart,deliveryEnd:j.deliveryEnd,linkedStatus:j.status}})
  }
 }
 window.XDRIVE_REAL=R;
 window.XDRIVE_REAL_JOBS=R.jobs;
 const notifyDirty=()=>{try{if(parent&&parent!==window)parent.postMessage({type:'xdrive:data-dirty'},'*')}catch(_e){}};
 const mutated=raw=>{const r=parse(raw);if(r&&Number(r.status)>=200&&Number(r.status)<300)notifyDirty();return r};
 window.XDriveApi={
  get:p=>parse(typeof XDriveNative.apiGetCached==='function'?XDriveNative.apiGetCached(p):XDriveNative.apiGet(p)),
  post:(p,b)=>mutated(XDriveNative.apiPost(p,JSON.stringify(b||{}))),
  postReliable:(p,b,k)=>mutated(typeof XDriveNative.apiPostReliable==='function'?XDriveNative.apiPostReliable(p,JSON.stringify(b||{}),String(k||'')):XDriveNative.apiPost(p,JSON.stringify(b||{}))),
  put:(p,b)=>mutated(XDriveNative.apiPut(p,JSON.stringify(b||{}))),
  del:p=>mutated(XDriveNative.apiDelete(p)),
  flushOffline:()=>parse(typeof XDriveNative.flushOfflineActions==='function'?XDriveNative.flushOfflineActions():'{"status":200,"body":{"ok":true,"pending":0}}'),
  offlineCount:()=>typeof XDriveNative.offlineActionCount==='function'?Number(XDriveNative.offlineActionCount()||0):0,
  ok:r=>r&&Number(r.status)>=200&&Number(r.status)<300,
  error:r=>r&&r.body&&typeof r.body==='object'?(r.body.error||r.body.message||'Request failed.'):'Request failed.'
 };
 if(path==='booking-detail.html'&&detailSnapshot&&selectedId){
  const nativeBridge=window.XDriveNative||(window.parent&&window.parent.XDriveNative)||(window.top&&window.top.XDriveNative);
  if(nativeBridge&&typeof nativeBridge.apiGetAsync==='function'){
   const requestId='booking-fresh:'+selectedId+':'+Date.now();
   const onFresh=event=>{
    const message=event.data||{};if(message.type!=='xdrive:api-result'||message.requestId!==requestId)return;
    window.removeEventListener('message',onFresh);
    const response=message.response||{},body=response.body||{};
    if(Number(response.status)>=200&&Number(response.status)<300&&body.job){
     const mapped=mapBooking(body.job),idx=(R.bookings||[]).findIndex(j=>String(j.id)===String(mapped.id));
     if(idx>=0)R.bookings[idx]=mapped;else R.bookings.unshift(mapped);
     window.XDRIVE_REAL=R;
     try{localStorage.setItem('xdrive-detail-snapshot-v1',JSON.stringify({jobId:String(mapped.id),from:detailOrigin||'bookings',at:Date.now(),job:mapped,quote:null}))}catch(_e){}
     window.dispatchEvent(new CustomEvent('xdrive:booking-refreshed',{detail:{job:mapped}}));
    }
   };
   window.addEventListener('message',onFresh);
   nativeBridge.apiGetAsync(requestId,'/api/driver/mobile/jobs/'+encodeURIComponent(selectedId));
  }
 }
 setTimeout(()=>{try{if(window.XDriveApi.offlineCount()>0)window.XDriveApi.flushOffline()}catch(_e){}},800);
 if(window.XDriveNative&&typeof XDriveNative.prewarmCoreData==='function'){
  setTimeout(()=>{try{XDriveNative.prewarmCoreData()}catch(_e){}},250);
 }
})();

