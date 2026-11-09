import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

export type ProfessionalPodDetails = {
 id:string; reference?:string|null;
 pickup_location?:string|null; delivery_location?:string|null;
 pickup_datetime?:string|null; delivery_datetime?:string|null;
 pod_generated_at?:string|null; collection_contact_name?:string|null;
 delivery_contact_name?:string|null; client_signature_name?:string|null;
 no_of_items?:number|null; items?:number|null; weight_kg?:number|null;
 delivery_status?:string|null; delivery_notes?:string|null;
};
export type HandoverDetails = {leftAt?:string|null;itemCount?:string|number|null;notes?:string|null;deliveryStatus?:string|null};

const navy=rgb(0.043,0.184,0.420), orange=rgb(0.961,0.639,0), white=rgb(1,1,1);
const grey=rgb(0.34,0.40,0.48), border=rgb(0.84,0.88,0.92), pale=rgb(0.97,0.98,0.99);
const success=rgb(0.09,0.43,0.28);
const safe=(v:unknown,missing='Not recorded')=>v===null||v===undefined||String(v).trim()===''?missing:String(v).replace(/[^\x20-\x7e]/g,' ').trim();
export const tidyPodAddress=(v:unknown)=>safe(v).replace(/,\s*GB,\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i,'').replace(/,\s*GB\s*$/i,'').trim();
const date=(v:unknown)=>{if(!v)return 'Not recorded';const d=new Date(String(v));return Number.isNaN(d.getTime())?'Not recorded':new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};
const wrapped=(font:PDFFont,value:unknown,size:number,width:number)=>{
 const words=safe(value).split(/\s+/);const out:string[]=[];let current='';
 for(const word of words){const next=current?current+' '+word:word;if(font.widthOfTextAtSize(next,size)<=width){current=next;continue}if(current)out.push(current);current='';if(font.widthOfTextAtSize(word,size)<=width){current=word;continue}let part='';for(const c of word){if(font.widthOfTextAtSize(part+c,size)>width&&part){out.push(part);part=''}part+=c}current=part}
 if(current)out.push(current);return out;
};
function drawLines(page:PDFPage,font:PDFFont,value:unknown,x:number,y:number,width:number,opts:{size?:number;leading?:number;max?:number;color?:ReturnType<typeof rgb>}={}){
 const size=opts.size??9.2,leading=opts.leading??13,max=opts.max??4;
 const chunks=wrapped(font,value,size,width);for(let i=0;i<Math.min(chunks.length,max);i++)page.drawText(chunks[i],{x,y:y-i*leading,size,font,color:opts.color??navy});
 if(chunks.length>max)page.drawText('See full job record for remaining details',{x,y:y-max*leading,size:7,font,color:grey});
}
export async function drawOfficialPodCover(pdf:PDFDocument,logoBytes:Uint8Array,carrierName:string,job:ProfessionalPodDetails,signature:string,photoCount:number,handover:HandoverDetails={}):Promise<void>{
 const page=pdf.addPage([595.28,841.89]);
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 // Recognisable platform identity: the real public/xdrive-logo-primary.png.
 const logo=await pdf.embedPng(logoBytes),ls=logo.scaleToFit(190,64);
 page.drawImage(logo,{x:37,y:765,width:ls.width,height:ls.height});
 page.drawText('OFFICIAL TRANSPORT RECORD',{x:345,y:801,size:8,font:bold,color:grey});
 page.drawText('PROOF OF DELIVERY',{x:345,y:780,size:12,font:bold,color:navy});
 page.drawRectangle({x:37,y:751,width:521,height:3,color:orange});
 page.drawText('Proof of Delivery',{x:38,y:711,size:23,font:bold,color:navy});
 page.drawText('Recipient handover and evidence of completed transport',{x:39,y:692,size:9,font:regular,color:grey});
 page.drawRectangle({x:38,y:650,width:519,height:26,color:rgb(.91,.96,.94),borderColor:rgb(.77,.87,.81),borderWidth:.6});
 page.drawText('DELIVERY COMPLETED  /  SIGNED',{x:50,y:658,size:9.8,font:bold,color:success});
 page.drawText('JOB REFERENCE',{x:38,y:633,size:7.5,font:bold,color:grey});
 drawLines(page,bold,job.reference||job.id,38,616,300,{size:11,max:1});
 page.drawText('POD RECORDED',{x:363,y:633,size:7.5,font:bold,color:grey});
 page.drawText(date(job.pod_generated_at),{x:363,y:616,size:9.2,font:bold,color:navy});
 page.drawLine({start:{x:38,y:603},end:{x:557,y:603},color:border,thickness:1});
 const locationCard=(x:number,kind:'COLLECTION'|'DELIVERY',loc:unknown,contact:unknown,time:unknown)=>{
   const y=387,w=249,h=199;
   page.drawRectangle({x,y,width:w,height:h,color:white,borderColor:border,borderWidth:1});
   page.drawRectangle({x,y:y+h-37,width:w,height:37,color:pale});
   page.drawRectangle({x,y:y+h-37,width:4,height:37,color:kind==='COLLECTION'?navy:orange});
   page.drawText(kind==='COLLECTION'?'01':'02',{x:x+13,y:y+h-24,size:12,font:bold,color:kind==='COLLECTION'?navy:orange});
   page.drawText(kind,{x:x+42,y:y+h-24,size:11,font:bold,color:navy});
   page.drawText('ADDRESS',{x:x+13,y:y+h-54,size:7.5,font:bold,color:grey});
   drawLines(page,bold,tidyPodAddress(loc),x+13,y+h-71,w-26,{size:9,leading:12,max:4});
   page.drawText('CONTACT',{x:x+13,y:y+65,size:7,font:bold,color:grey});
   drawLines(page,regular,contact,x+13,y+51,w-26,{size:9,max:1});
   page.drawText('SCHEDULED SLOT',{x:x+13,y:y+31,size:7,font:bold,color:grey});
   page.drawText(date(time),{x:x+13,y:y+16,size:9,font:regular,color:navy});
 };
 locationCard(38,'COLLECTION',job.pickup_location,job.collection_contact_name,job.pickup_datetime);
 locationCard(308,'DELIVERY',job.delivery_location,job.delivery_contact_name,job.delivery_datetime);
 page.drawRectangle({x:38,y:270,width:519,height:102,color:pale,borderColor:border,borderWidth:1});
 page.drawText('RECIPIENT HANDOVER',{x:50,y:353,size:10,font:bold,color:navy});
 page.drawLine({start:{x:50,y:343},end:{x:545,y:343},color:border,thickness:.7});
 page.drawText('Received by',{x:50,y:324,size:8,font:regular,color:grey});
 drawLines(page,bold,job.client_signature_name,125,324,195,{size:9.5,max:1});
 page.drawText('Left at',{x:337,y:324,size:8,font:regular,color:grey});
 drawLines(page,bold,handover.leftAt,393,324,147,{size:9,max:1});
 page.drawText('Items',{x:50,y:297,size:8,font:regular,color:grey});
 page.drawText(safe(handover.itemCount??job.no_of_items??job.items),{x:125,y:297,size:9,font:bold,color:navy});
 page.drawText('Condition',{x:205,y:297,size:8,font:regular,color:grey});
 drawLines(page,bold,handover.deliveryStatus||job.delivery_status||'Completed delivery',281,297,263,{size:9,max:1});
 page.drawText('Delivery photos',{x:50,y:279,size:8,font:regular,color:grey});
 page.drawText(String(photoCount),{x:125,y:279,size:9,font:bold,color:navy});
 page.drawText('RECIPIENT SIGNATURE',{x:38,y:251,size:10,font:bold,color:navy});
 page.drawRectangle({x:38,y:104,width:519,height:135,color:white,borderColor:border,borderWidth:1});
 const data=Buffer.from(signature.split(',')[1],'base64');
 const image=/^data:image\/png/i.test(signature)?await pdf.embedPng(data):await pdf.embedJpg(data);
 const scaled=image.scaleToFit(475,107);
 page.drawImage(image,{x:56+(475-scaled.width)/2,y:117+(107-scaled.height)/2,width:scaled.width,height:scaled.height});
 page.drawLine({start:{x:38,y:86},end:{x:557,y:86},color:border,thickness:.8});
 page.drawText('Executing carrier: '+safe(carrierName),{x:38,y:70,size:8,font:bold,color:navy});
 page.drawText('Photo evidence follows on the next pages  |  A4 digital POD',{x:38,y:55,size:7.6,font:regular,color:grey});
 page.drawText('XDrive Logistics',{x:466,y:36,size:8,font:bold,color:navy});
}
