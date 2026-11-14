import {useEffect,useMemo,useState} from 'react';
import './EvidenceImageEditor.css';

type Crop = 'original'|'square'|'document';
type Props = {file:File;onCancel:()=>void;onSave:(file:File)=>void};
function outputDimensions(w:number,h:number,crop:Crop,rotation:number){
 const rotated=rotation%180===0?{w,h}:{w:h,h:w};
 const ratio=crop==='square'?1:crop==='document'?Math.SQRT2:rotated.w/rotated.h;
 let outW=rotated.w, outH=rotated.h;
 if(outW/outH>ratio)outW=Math.round(outH*ratio);
 else outH=Math.round(outW/ratio);
 return {width:Math.max(1,outW),height:Math.max(1,outH),fullW:rotated.w,fullH:rotated.h};
}
export default function EvidenceImageEditor({file,onCancel,onSave}:Props){
 const [rotation,setRotation]=useState(0);
 const [crop,setCrop]=useState<Crop>('original');
 const [source,setSource]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [dimensions,setDimensions]=useState<{width:number;height:number}|null>(null);
 useEffect(()=>{
  let active=true;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{if(active){setSource(url);setDimensions({width:img.naturalWidth,height:img.naturalHeight});}};
  img.onerror=()=>{if(active)setError('This image could not be opened. Choose another JPEG or PNG.');};
  img.src=url;
  return()=>{active=false;URL.revokeObjectURL(url);};
 },[file]);
 const geometry=useMemo(()=>dimensions?outputDimensions(dimensions.width,dimensions.height,crop,rotation):null,[dimensions,crop,rotation]);
 const save=async()=>{
  if(!source||!geometry||busy)return;
  setBusy(true);setError('');
  try{
   const image=new Image();image.src=source;await image.decode();
   const output=document.createElement('canvas');
   // Limit pixel dimensions so mobile browsers can process photos from modern phone cameras.
   const limit=Math.min(1,2200/Math.max(geometry.width,geometry.height));
   output.width=Math.max(1,Math.round(geometry.width*limit));
   output.height=Math.max(1,Math.round(geometry.height*limit));
   const context=output.getContext('2d');
   if(!context)throw new Error('Image editing is not supported by this browser.');
   context.fillStyle='#FFFFFF';context.fillRect(0,0,output.width,output.height);
   context.translate(output.width/2,output.height/2);
   context.scale(output.width/geometry.width,output.height/geometry.height);
   context.rotate(rotation*Math.PI/180);
   // Draw full-size rotated image, cropping equally from its edges around the centre.
   context.drawImage(image,-dimensions!.width/2,-dimensions!.height/2,dimensions!.width,dimensions!.height);
   const blob=await new Promise<Blob|null>(resolve=>output.toBlob(resolve,'image/jpeg',0.9));
   if(!blob)throw new Error('The edited photo could not be generated.');
   if(blob.size>10*1024*1024)throw new Error('Edited photo exceeds the 10 MB upload limit.');
   const original=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_');
   onSave(new File([blob],original+'-edited.jpg',{type:'image/jpeg',lastModified:Date.now()}));
  }catch(e){setError(e instanceof Error?e.message:'Could not save edited photo.');}
  finally{setBusy(false);}
 };
 return <section className="xe-editor" aria-label="Edit delivery image" role="dialog" aria-modal="true">
  <div className="xe-title"><h3>Edit delivery photo</h3><button type="button" onClick={onCancel} aria-label="Close photo editor">×</button></div>
  <p>Rotate or crop the photo before attaching it to the signed POD. The original is not changed.</p>
  {source&&<div className={'xe-preview xe-crop-'+crop}>
    <img src={source} alt="Photo being edited" style={{transform:'rotate('+rotation+'deg)',maxWidth:rotation%180===0?'100%':'72%',maxHeight:rotation%180===0?'100%':'72%'}}/>
  </div>}
  {!source&&!error&&<p role="status">Opening image…</p>}
  <div className="xe-controls">
    <button type="button" onClick={()=>setRotation(r=>(r+270)%360)}>Rotate left</button>
    <button type="button" onClick={()=>setRotation(r=>(r+90)%360)}>Rotate right</button>
  </div>
  <label className="xe-crop-label">Crop format
    <select value={crop} onChange={e=>setCrop(e.target.value as Crop)}>
      <option value="original">Full photo</option><option value="square">Square (1:1)</option><option value="document">Document (A-series)</option>
    </select>
  </label>
  {error&&<p className="xe-error" role="alert">{error}</p>}
  <div className="xe-actions">
    <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
    <button type="button" onClick={()=>void save()} disabled={busy||!source}>{busy?'Saving…':'Attach edited image'}</button>
  </div>
 </section>;
}
