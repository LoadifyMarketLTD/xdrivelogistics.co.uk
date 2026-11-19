import {describe,it,expect,vi} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {buildReserveStopAppendix} from '../lib/server/reserveMultiStopPod';
const img=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/L8sAAAAASUVORK5CYII=','base64'));
function stop(sequence:number,type:'collection'|'delivery'){
 const id='s'+sequence,p='carrier/job/stops/'+id;
 return {id,sequence,stop_type:type,address:'QA Stop '+sequence,status:'completed',completed_at:'2026-11-19T12:00:00Z',handover:{version:3,itemCount:1,photoPaths:[p+'/photos/p.png'],documentPaths:[],...(type==='delivery'?{recipientName:'QA ONLY',leftAt:'Goods Inwards',deliveredOn:'2026-11-19T12:00:00Z',deliveryStatus:'Completed Delivery',signaturePath:p+'/signature/s.png'}:{})}};
}
describe('Consolidated Reserve POD',()=> {
 it('contains metadata and separate verified evidence for every collection/delivery',async()=>{const read=vi.fn(async(_path:string)=>img);const bytes=await buildReserveStopAppendix('job','carrier',[stop(3,'delivery'),stop(1,'collection'),stop(2,'delivery')],read);expect(bytes).not.toBeNull();expect((await PDFDocument.load(bytes!)).getPageCount()).toBe(8);expect(read.mock.calls.map(x=>x[0])).toEqual(['carrier/job/stops/s1/photos/p.png','carrier/job/stops/s2/signature/s.png','carrier/job/stops/s2/photos/p.png','carrier/job/stops/s3/signature/s.png','carrier/job/stops/s3/photos/p.png']);});
 it('does not convert unfinished stops into a signed POD',async()=>{await expect(buildReserveStopAppendix('job','carrier',[stop(1,'collection'),{...stop(2,'delivery'),status:'pending'},stop(3,'delivery')],async()=>img)).rejects.toThrow('verified completion');});
 it('blocks missing or cross-stop evidence',async()=>{const s=stop(2,'delivery');s.handover.photoPaths=['carrier/job/stops/s1/photos/p.png'];await expect(buildReserveStopAppendix('job','carrier',[stop(1,'collection'),s],async()=>img)).rejects.toThrow('scope mismatch');await expect(buildReserveStopAppendix('job','carrier',[{...s,handover:{...s.handover,photoPaths:[]}},stop(1,'collection')],async()=>img)).rejects.toThrow('incomplete');});
 it('does not demand new proof for unchanged historical standard routes',async()=>{expect(await buildReserveStopAppendix('job','carrier',[],async()=>img)).toBeNull();});
});