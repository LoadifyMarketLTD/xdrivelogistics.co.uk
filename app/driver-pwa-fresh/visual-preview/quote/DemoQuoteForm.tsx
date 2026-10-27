'use client';
import { useState } from 'react';
export default function DemoQuoteForm(){
 const [price,setPrice]=useState('');
 const [submitted,setSubmitted]=useState(false);
 const [error,setError]=useState('');
 const submit=()=>{
  const amount=Number(price);
  if(!price.trim() || !Number.isFinite(amount) || amount<=0){setError('Enter a valid quote amount.');return;}
  setError('');setSubmitted(true);
 };
 return <>
  <section className="fresh-quote-panel"><label>My Quote (GBP) *<input aria-label="My Quote (GBP)" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Price excluding VAT" value={price} onChange={e=>setPrice(e.target.value)} disabled={submitted}/></label></section>
  <div className="fresh-quote-submit">{submitted?<p role="status">Demo quote submitted successfully. No real quote was sent.</p>:<button type="button" onClick={submit}>Submit Quote</button>}{error?<p role="alert">{error}</p>:null}<p>Visual preview only. No real quote will be sent.</p></div>
 </>;
}
