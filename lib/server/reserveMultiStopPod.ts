import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scopedStopEvidenceObject, stopEvidencePrefix } from '../jobs/driverStopExecution';
import { deliveryRouteBlocker } from '../jobs/deliveryRouteGuard';

type Stop = { id:string; sequence:number; stop_type:'collection'|'delivery'; address:string; postcode?:string|null; status:string; en_route_at?:string|null; arrived_at?:string|null; completed_at?:string|null; handover:unknown };
type ObjectData = Record<string,unknown>;
const object = (v:unknown):ObjectData => v && typeof v==='object' && !Array.isArray(v)?v as ObjectData:{};
const text = (v:unknown) => String(v??'').trim().normalize('NFKD').replace(/[^\x20-\x7e]/g,' ');
function paths(v:unknown):string[] {
 if(v==null)return [];
 if(!Array.isArray(v)||v.length>10||v.some(p=>typeof p!=='string'||!p.trim()))throw new Error('Invalid per-stop evidence list.');
 return [...new Set(v as string[])];
}
function wrap(v:string,font:PDFFont,width:number,size:number){
 const out:string[]=[];let line='';
 for(const word of v.split(/\s+/)){
  const combined=line?line+' '+word:word;
  if(font.widthOfTextAtSize(combined,size)<=width){line=combined;continue;}
  if(line)out.push(line);line='';
  for(const c of word){if(line&&font.widthOfTextAtSize(line+c,size)>width){out.push(line);line='';}line+=c;}
 }
 if(line)out.push(line);return out;
}
export async function buildReserveStopAppendix(jobId:string,companyId:string,stops:Stop[],download:(path:string)=>Promise<Uint8Array>){
 const ordered=[...stops].sort((a,b)=>a.sequence-b.sequence);
 const modern=ordered.some(s=>object(s.handover).version===3);
 if(ordered.some(s=>{const h=object(s.handover);return h.stopKind==='return'||h.stopKind==='redirect'||object(h.returnInstruction).resolutionRequired===true;}))throw new Error('Return or redirected custody evidence requires a separate Proof of Return or resolution document.');
 if(!modern)return null;
 if(ordered.length>50)throw new Error('Route contains too many stops for this POD document.');
 if(deliveryRouteBlocker(ordered,true))throw new Error('All route stops require verified completion before a consolidated POD can be issued.');
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const navy=rgb(.04,.15,.33),orange=rgb(.96,.64,.0);
 function header(title:string){
  const p=pdf.addPage([595.28,841.89]);p.drawRectangle({x:0,y:824,width:595.28,height:18,color:navy});p.drawRectangle({x:0,y:819,width:595.28,height:5,color:orange});
  p.drawText('XDRIVE LOGISTICS  |  CONSOLIDATED POD',{x:40,y:787,size:12,font:bold,color:navy});
  p.drawText('Job XDL-'+jobId.slice(0,8).toUpperCase(),{x:40,y:764,size:10,font,color:navy});
  p.drawText(title,{x:40,y:733,size:15,font:bold,color:navy});return p;
 }
 for(const stop of ordered){
  const h=object(stop.handover),title='Stop '+stop.sequence+' - '+(stop.stop_type==='collection'?'Collection':'Delivery');
  const photos=paths(h.photoPaths),docs=paths(h.documentPaths),signature=text(h.signaturePath);
  if(photos.length<1||!stop.completed_at||stop.stop_type==='delivery'&&(!signature||!text(h.recipientName)||!text(h.leftAt)||!text(h.deliveredOn)||h.deliveryStatus!=='Completed Delivery'||!Number.isInteger(Number(h.itemCount))||Number(h.itemCount)<1))throw new Error('Stop '+stop.sequence+' evidence is incomplete.');
  const read=async(path:string,kind:'photos'|'documents'|'signature')=>{
   if(!scopedStopEvidenceObject(path,stopEvidencePrefix(companyId,jobId,stop.id,kind)))throw new Error('Stop evidence scope mismatch.');
   const data=await download(path);if(!data.length||data.length>10*1024*1024)throw new Error('Stop evidence is missing or oversized.');
   return data;
  };
  const metadata=[
   'Address: '+[text(stop.address),text(stop.postcode)].filter(Boolean).join(', '),
   'Status: '+stop.status,
   'En route: '+(text(stop.en_route_at)||'Not recorded'),
   'Arrived: '+(text(stop.arrived_at)||'Not recorded'),
   'Completed: '+text(stop.completed_at),
   'Items: '+(text(h.itemCount)||'Not recorded'),
   'Weight (kg): '+(text(h.weightKg)||'Not recorded'),
   'Packaging: '+(text(h.packaging)||'Not recorded'),
   'Received by: '+(text(h.recipientName)||'Not applicable'),
   'Left at: '+(text(h.leftAt)||'Not applicable'),
   'Delivered on: '+(text(h.deliveredOn)||'Not applicable'),
   'Notes: '+(text(h.notes)||'None'),
   'Evidence: '+photos.length+' photo(s), '+docs.length+' document(s)'+(signature?', recipient signature':''),
  ];
  let page=header(title),y=702;
  for(const item of metadata)for(const line of wrap(item,font,515,10)){
   if(y<70){page=header(title+' (continued)');y=702;}
   page.drawText(line,{x:40,y,size:10,font,color:navy});y-=15;
  }
  if(signature){
   const bytes=await read(signature,'signature');const png=bytes[0]===137&&bytes[1]===80;const image=png?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
   const p=header(title+' - Recipient signature');const size=image.scaleToFit(515,580);p.drawImage(image,{x:40,y:700-size.height,width:size.width,height:size.height});
  }
  for(let i=0;i<photos.length;i++){
   const bytes=await read(photos[i],'photos');const png=bytes[0]===137&&bytes[1]===80;const image=png?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
   const p=header(title+' - Photograph '+(i+1));const size=image.scaleToFit(515,625);p.drawImage(image,{x:40,y:700-size.height,width:size.width,height:size.height});
  }
  for(const path of docs){
   const bytes=await read(path,'documents');
   if(String.fromCharCode(...bytes.slice(0,5))==='%PDF-'){header(title+' - Supporting document');const embedded=await PDFDocument.load(bytes);for(const p of await pdf.copyPages(embedded,embedded.getPageIndices()))pdf.addPage(p);}
   else{const image=bytes[0]===137&&bytes[1]===80?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const p=header(title+' - Supporting document');const size=image.scaleToFit(515,625);p.drawImage(image,{x:40,y:700-size.height,width:size.width,height:size.height});}
  }
 }
 return pdf.save();
}
export async function loadReserveStopAppendix(supabase:SupabaseClient,jobId:string,companyId:string){
 const {data,error}=await supabase.from('job_stops').select('id,sequence,stop_type,address,postcode,status,en_route_at,arrived_at,completed_at,handover').eq('job_id',jobId).order('sequence',{ascending:true});
 if(error)throw new Error('Stop evidence could not be verified.');
 return buildReserveStopAppendix(jobId,companyId,(data??[]) as Stop[],async path=>{
  const {data,error}=await supabase.storage.from('pod-photos').download(path);
  if(error||!data)throw new Error('Archived stop evidence could not be downloaded.');
  return new Uint8Array(await data.arrayBuffer());
 });
}