'use client';
import {useState} from 'react';
export default function DemoActions(){
 const [saved,setSaved]=useState(false);
 const [deleted,setDeleted]=useState(false);
 return <div className="fresh-preview-secondary">
 <button type="button" onClick={()=>setSaved(v=>!v)} aria-pressed={saved}>{saved?'SAVED':'SAVE'}</button>
 <button type="button" onClick={()=>setDeleted(v=>!v)} aria-pressed={deleted}>{deleted?'RESTORE':'DELETE'}</button>
 <p className="fresh-muted" role="status">{deleted?'Demo load removed from this view. Tap RESTORE to undo.':saved?'Demo load saved for this preview.':'Preview actions are simulated; no real load is changed.'}</p>
 </div>;
}
