import { useRef, useState } from 'react';
import type { LiveJob } from './liveApi';
import EvidenceImageEditor from './EvidenceImageEditor';

type Props = {
  job: LiveJob; items: string; weight: string; packaging: string; eta: string; notes: string;
  files: File[]; busy: boolean;
  onItems: (value: string) => void; onWeight: (value: string) => void;
  onPackaging: (value: string) => void; onEta: (value: string) => void; onNotes: (value: string) => void;
  onFiles: (files: File[]) => void; onConfirm: () => void; onBack: () => void;
};
const increments = [15, 30, 45, 60, 90, 120, 180, 240, 300];
export default function BookingCollectionForm({
  job, items, weight, packaging, eta, notes, files, busy,
  onItems, onWeight, onPackaging, onEta, onNotes, onFiles, onConfirm, onBack,
}: Props) {
  const [page, setPage] = useState<'arrival'|'loaded'>('arrival');
  const [picker, setPicker] = useState(false);
  const [editingPhoto,setEditingPhoto]=useState<File|null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);
  const addFiles = (selection: FileList | null) => {
    if (!selection) return;
    const added = Array.from(selection);
    const existing = new Set(files.map(f => [f.name, f.size, f.lastModified].join('|')));
    const next = [...files];
    for(const f of added) {
      const key = [f.name, f.size, f.lastModified].join('|');
      if (!existing.has(key)) {next.push(f); existing.add(key);}
    }
    onFiles(next);
    setPicker(false);
  };
  return <div className="xb-collection" aria-label="Collection and loaded information">
    <div className="xb-collection-steps" aria-label="Collection progress">
      <span className={page==='arrival'?'xb-selected':''}>1. On Site Collection</span>
      <span className={page==='loaded'?'xb-selected':''}>2. Loaded Info</span>
    </div>
    {page==='arrival' ? <section className="xb-collection-panel">
      <h3>On Site (Collection)</h3>
      <p className="xb-muted">Check the pickup location and record any collection notes or supporting evidence.</p>
      <div className="xb-address"><strong>Collection address</strong>
        <p>{job.pickupAddress || [job.from,job.fromOutcode].filter(Boolean).join(', ')}</p></div>
      <div className="xb-address"><strong>Vehicle</strong><p>{job.vehicle || 'Not provided'}</p></div>
      <label className="xb-form-field"><span>Driver's Notes (optional)</span>
        <textarea value={notes} maxLength={2000} rows={3} placeholder="Goods collected, access information, handling issues…" onChange={e=>onNotes(e.target.value)}/></label>
      <small className="xb-character-count">{notes.length}/2000</small>
      <p className="xb-muted">No photo or ETA is compulsory unless the customer specifically requests it.</p>
    </section> : <section className="xb-collection-panel">
      <h3>Loaded Info</h3>
      <p className="xb-muted">Record the actual load before changing the booking to Loaded.</p>
      <div className="xb-form-grid">
        <label className="xb-form-field"><span>Number of Items</span>
          <div className="xb-stepper">
            <input aria-label="Number of Items" type="number" min="0" step="1" value={items} onChange={e=>onItems(e.target.value)}/>
            <button type="button" onClick={()=>onItems(String(Math.max(0,(Number(items)||0)-1)))} aria-label="Decrease item count">−</button>
            <button type="button" onClick={()=>onItems(String(Math.max(0,(Number(items)||0)+1)))} aria-label="Increase item count">+</button>
          </div></label>
        <label className="xb-form-field"><span>Weight (kg)</span>
          <input type="number" min="0" step="any" value={weight} onChange={e=>onWeight(e.target.value)}/></label>
      </div>
      <label className="xb-form-field"><span>Packaging</span>
        <input type="text" maxLength={120} placeholder="Pallets, boxes, packages…" value={packaging} onChange={e=>onPackaging(e.target.value)}/></label>
      <label className="xb-form-field"><span>ETA to delivery (optional)</span>
        <select value={eta} onChange={e=>onEta(e.target.value)}>
          <option value="">Not provided</option><option value="0">ASAP</option>
          {increments.map(value=><option key={value} value={value}>{value} minutes</option>)}
        </select></label>
      <label className="xb-form-field"><span>Driver's Notes (optional)</span>
        <textarea value={notes} maxLength={2000} rows={3} onChange={e=>onNotes(e.target.value)}/></label>
    </section>}
    <section className="xb-collection-panel xb-evidence">
      <div className="xb-evidence-header">
        <div><h3>Documents & photos</h3><p>Camera, gallery or PDF · optional</p></div>
        <span>{files.length} selected</span>
      </div>
      <button className="xb-add-document" type="button" aria-expanded={picker} onClick={()=>setPicker(v=>!v)}>＋ Add Document</button>
      {picker && <div className="xb-evidence-choices">
        <button type="button" onClick={()=>camera.current?.click()}>Camera</button>
        <button type="button" onClick={()=>gallery.current?.click()}>Image</button>
        <button type="button" onClick={()=>documents.current?.click()}>Document</button>
      </div>}
      <input ref={camera} style={{display:'none'}} tabIndex={-1} aria-label="Capture collection photo" type="file" accept="image/jpeg,image/png" capture="environment"
        onChange={e=>{addFiles(e.target.files);e.target.value='';}}/>
      <input ref={gallery} style={{display:'none'}} tabIndex={-1} aria-label="Select collection images" type="file" accept="image/jpeg,image/png" multiple
        onChange={e=>{addFiles(e.target.files);e.target.value='';}}/>
      <input ref={documents} style={{display:'none'}} tabIndex={-1} aria-label="Select collection document" type="file" accept="application/pdf,image/jpeg,image/png" multiple
        onChange={e=>{addFiles(e.target.files);e.target.value='';}}/>
      {editingPhoto&&<EvidenceImageEditor file={editingPhoto} onCancel={()=>setEditingPhoto(null)} onSave={edited=>{onFiles([...files.filter(f=>f!==editingPhoto),edited]);setEditingPhoto(null);}}/>}
      {files.length>0 && <ul className="xb-file-list">
        {files.map((file,index)=><li key={file.name+'-'+file.lastModified+'-'+index}>
          <span>{file.name} <small>{Math.ceil(file.size/1024)} KB</small></span>
          {file.type.startsWith('image/')&&<button type="button" onClick={()=>setEditingPhoto(file)}>Rotate / Crop</button>}
          <button type="button" aria-label={'Remove '+file.name} onClick={()=>onFiles(files.filter((_,i)=>i!==index))}>Remove</button>
        </li>)}
      </ul>}
      <p className="xb-muted">Files are uploaded only when you confirm Loaded. Failed uploads do not advance the job status.</p>
    </section>
    <div className="xb-form-actions">
      <button type="button" className="xb-secondary" onClick={page==='arrival'?onBack:()=>setPage('arrival')}>{page==='arrival'?'Booking status':'Back'}</button>
      <button type="button" className="xb-primary" disabled={busy}
        onClick={page==='arrival'?()=>setPage('loaded'):onConfirm}>
        {busy?'Saving…':page==='arrival'?'Continue to Loaded Info':'Confirm Loaded'}
      </button>
    </div>
  </div>;
}
