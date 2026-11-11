import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
export type ProfessionalPodDetails = {
 id:string;reference?:string|null;pickup_location?:string|null;delivery_location?:string|null;
 pickup_datetime?:string|null;delivery_datetime?:string|null;delivered_at?:string|null;pod_generated_at?:string|null;
 collection_contact_name?:string|null;delivery_contact_name?:string|null;client_signature_name?:string|null;
 no_of_items?:number|null;items?:number|null;weight_kg?:number|null;delivery_status?:string|null;delivery_notes?:string|null;
 vehicle_type?:string|null;cargo_type?:string|null;
};
export type HandoverDetails = {leftAt?:string|null;itemCount?:string|number|null;notes?:string|null;deliveryStatus?:string|null};
const navy=rgb(.039,.149,.326),orange=rgb(.968,.678,.043),white=rgb(1,1,1);
const grey=rgb(.32,.39,.48),edge=rgb(.82,.86,.91),pale=rgb(.96,.97,.985);
const valid=(v:unknown)=>v!=null&&String(v).trim().length>0;
const clean=(v:unknown,fallback='Not recorded')=>valid(v)?String(v).replace(/[^\x20-\x7e]/g,' ').trim():fallback;
export const tidyPodAddress=(v:unknown)=>clean(v).replace(/,\s*GB,\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i,'').replace(/,\s*GB\s*$/i,'').trim();
const dateLabel=(v:unknown)=>{if(!valid(v))return 'Not recorded';const d=new Date(String(v));return Number.isNaN(d.getTime())?'Not recorded':new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};
const wrap=(font:PDFFont,v:unknown,size:number,width:number)=>{const result:string[]=[];let line='';for(const word of clean(v).split(/\s+/)){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)<=width){line=next;continue;}if(line)result.push(line);line='';for(const char of word){if(font.widthOfTextAtSize(line+char,size)>width&&line){result.push(line);line='';}line+=char;}}if(line)result.push(line);return result;};
const lines=(page:PDFPage,font:PDFFont,v:unknown,x:number,y:number,width:number,o:{size?:number;lead?:number;max?:number;color?:ReturnType<typeof rgb>}={})=>{
 const size=o.size??9,lead=o.lead??12,all=wrap(font,v,size,width),max=o.max??3;
 all.slice(0,max).forEach((t,i)=>page.drawText(t,{x,y:y-i*lead,size,font,color:o.color??navy}));
 if(all.length>max)page.drawText('See original job record',{x,y:y-max*lead,size:7,font,color:grey});
};
export async function drawOfficialPodCover(pdf:PDFDocument,logoBytes:Uint8Array,carrierName:string,job:ProfessionalPodDetails,signature:string,photoCount:number,handover:HandoverDetails={}):Promise<void>{
 const page=pdf.addPage([595.28,841.89]),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const frame=(x:number,y:number,w:number,h:number,fill=white)=>page.drawRectangle({x,y,width:w,height:h,color:fill,borderColor:edge,borderWidth:.75});
 const label=(s:string,x:number,y:number)=>page.drawText(s.toUpperCase(),{x,y,size:7.6,font:bold,color:grey});
 const entry=(s:unknown,x:number,y:number,w:number,size=9.6)=>lines(page,bold,s,x,y,w,{size,lead:12,max:2});
 page.drawRectangle({x:0,y:825,width:595.28,height:17,color:navy});
 page.drawRectangle({x:0,y:820,width:595.28,height:5,color:orange});
 const logo=await pdf.embedPng(logoBytes),ls=logo.scaleToFit(210,66);
 page.drawImage(logo,{x:40,y:741,width:ls.width,height:ls.height});
 page.drawText('PROOF OF DELIVERY',{x:314,y:777,size:18.7,font:bold,color:navy});
 page.drawRectangle({x:314,y:764,width:242,height:2.5,color:orange});
 page.drawText('FREIGHT TRANSPORT SERVICES',{x:348,y:747,size:8.2,font:bold,color:grey});
 frame(40,643,515,67,pale);
 const summary=[
  {l:'POD REFERENCE',v:'POD / '+clean(job.reference||job.id),x:51,w:132},
  {l:'DELIVERED ON',v:dateLabel(job.delivered_at??job.pod_generated_at),x:188,w:124},
  {l:'JOB REFERENCE',v:clean(job.reference||job.id),x:322,w:121},
  {l:'RECIPIENT',v:clean(job.client_signature_name),x:454,w:95},
 ];
 summary.forEach(({l,v,x,w})=>{label(l,x,685);lines(page,bold,v,x,666,w,{size:9,lead:10,max:2});});
 const cards=[{x:40,title:'COLLECTION',accent:navy,address:job.pickup_location,date:job.pickup_datetime,contact:job.collection_contact_name},
 {x:306,title:'DELIVERY',accent:orange,address:job.delivery_location,date:job.delivered_at??job.pod_generated_at,contact:job.client_signature_name}];
 cards.forEach(({x,title,accent,address,date,contact})=>{
  frame(x,403,249,218);page.drawRectangle({x,y:588,width:249,height:33,color:pale});
  page.drawRectangle({x,y:588,width:4,height:33,color:accent});
  page.drawText(title,{x:x+14,y:599,size:12,font:bold,color:navy});
  label(title==='COLLECTION'?'COLLECTION SLOT':'ACTUAL DELIVERY',x+14,568);
  entry(dateLabel(date),x+14,552,217,9.6);
  label('ADDRESS',x+14,523);
  lines(page,bold,tidyPodAddress(address),x+14,507,218,{size:9.3,lead:12,max:3});
  page.drawLine({start:{x:x+14,y:463},end:{x:x+233,y:463},thickness:.75,color:edge});
  label(title==='COLLECTION'?'COLLECTION CONTACT':'RECEIVED BY',x+14,446);
  lines(page,reg,contact,x+14,432,217,{size:8.8,max:2});
 });
 page.drawText('HANDOVER & POD DETAILS',{x:40,y:377,size:12,font:bold,color:navy});
 page.drawLine({start:{x:40,y:369},end:{x:555,y:369},thickness:.8,color:edge});
 frame(40,180,515,176);
 page.drawLine({start:{x:327,y:193},end:{x:327,y:344},thickness:.8,color:edge});
 const rows=[
 ['Vehicle / service',clean(job.vehicle_type)],
 ['Cargo / items',clean(handover.itemCount??job.no_of_items??job.items)],
 ['Delivery status','Completed'],
 ['Left at',clean(handover.leftAt)],
 ['Delivery result',clean(handover.deliveryStatus??job.delivery_status)],
 ['Delivery photos',String(photoCount)+' attached'],
 ];
 rows.forEach(([n,v],i)=>{const y=335-i*23;page.drawText(n,{x:54,y,size:8.3,font:bold,color:grey});lines(page,reg,v,151,y,159,{size:8.3,max:1});});
 label('RECIPIENT SIGNATURE',344,336);
 page.drawRectangle({x:343,y:221,width:194,height:102,color:white,borderColor:edge,borderWidth:1});
 const bytes=Buffer.from(signature.split(',')[1],'base64');
 const signatureImage=/^data:image\/png/i.test(signature)?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
 const ss=signatureImage.scaleToFit(172,82);
 page.drawImage(signatureImage,{x:354+(172-ss.width)/2,y:233+(82-ss.height)/2,width:ss.width,height:ss.height});
 page.drawText('Signed by '+clean(job.client_signature_name),{x:344,y:205,size:8,font:reg,color:grey});
 label('DELIVERY NOTES',40,163);
 lines(page,reg,handover.notes??job.delivery_notes,40,150,515,{size:8.3,max:2,lead:11});
 frame(40,70,515,58,pale);
 page.drawText('EVIDENCE',{x:53,y:107,font:bold,size:10,color:navy});
 page.drawRectangle({x:53,y:101,width:182,height:2,color:orange});
 page.drawText(String(photoCount)+' delivery photograph(s) attached on subsequent pages',{x:53,y:85,size:8.1,font:reg,color:grey});
 page.drawRectangle({x:317,y:70,width:238,height:58,color:navy});
 page.drawText('DELIVERY COMPLETED',{x:338,y:92,size:13,font:bold,color:white});
 page.drawLine({start:{x:40,y:52},end:{x:555,y:52},thickness:.8,color:edge});
 page.drawText('Issued by '+clean(carrierName)+'  |  Original signed evidence preserved',{x:40,y:37,size:7.7,font:reg,color:grey});
 page.drawText('1 / POD',{x:519,y:37,size:7.5,font:bold,color:navy});
}
