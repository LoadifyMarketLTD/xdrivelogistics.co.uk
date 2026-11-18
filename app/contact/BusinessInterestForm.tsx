'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

const field='w-full rounded-md border border-[#C9D8EE] bg-white px-3 py-3 text-sm text-[#002B6C] focus:outline-2 focus:outline-[#0E3FA9]';
type Kind='membership'|'partnership'|'commercial'|'other';

export default function BusinessInterestForm(){
  const [businessName,setBusinessName]=useState('');
  const [contactName,setContactName]=useState('');
  const [businessEmail,setBusinessEmail]=useState('');
  const [companyNumber,setCompanyNumber]=useState('');
  const [interestKind,setInterestKind]=useState<Kind>('membership');
  const [message,setMessage]=useState('');
  const [privacyAccepted,setPrivacyAccepted]=useState(false);
  const [marketingOptIn,setMarketingOptIn]=useState(false);
  const [companyWebsite,setCompanyWebsite]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [reference,setReference]=useState('');
  const send=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;
    setBusy(true);setError('');setReference('');
    try{
      const res=await fetch('/api/public/business-interest',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({businessName,contactName,businessEmail,companyNumber,
          interestKind,message,privacyAccepted,marketingOptIn,companyWebsite}),
      });
      const data=await res.json() as {error?:string;reference?:string;accepted?:boolean};
      if(!res.ok)throw Error(data.error??'Enquiry could not be recorded.');
      if(data.reference)setReference(data.reference);
      else if(data.accepted)setReference('Received');
    }catch(cause){setError(cause instanceof Error?cause.message:'Business enquiry unavailable.');}
    finally{setBusy(false);}
  };
  return <section aria-labelledby="business-interest-heading" className="bg-[#F4F6F8] px-5 py-14 sm:px-8">
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-widest text-[#0E3FA9]">Business enquiries</p>
        <h2 id="business-interest-heading" className="mt-2 text-3xl font-black text-[#0A234F]">Talk to our commercial team</h2>
        <p className="mt-2 text-sm leading-7 text-[#4B5563]">
          For B2B membership, partnerships and commercial introductions. Transport quotes use the existing
          quotation process. Enquiries are reviewed by our team before any CRM classification.
        </p>
      </div>
      <form onSubmit={send} className="grid max-w-3xl gap-5 border border-[#D7E6FA] bg-white p-6 sm:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-[#0A234F]">Business name
            <input className={field} required maxLength={240} minLength={2} value={businessName} onChange={e=>setBusinessName(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#0A234F]">Your name
            <input className={field} required maxLength={120} minLength={2} value={contactName} onChange={e=>setContactName(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#0A234F]">Business email
            <input className={field} required type="email" maxLength={254} value={businessEmail} onChange={e=>setBusinessEmail(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#0A234F]">Company number (optional)
            <input className={field} maxLength={32} value={companyNumber} onChange={e=>setCompanyNumber(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-[#0A234F]">I'm interested in
          <select className={field} value={interestKind} onChange={e=>setInterestKind(e.target.value as Kind)}>
            <option value="membership">Joining the XDrive network</option>
            <option value="partnership">Partnership or business collaboration</option>
            <option value="commercial">Commercial service enquiry</option>
            <option value="other">Other business question</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[#0A234F]">Tell us about your business enquiry
          <textarea className={field} required minLength={15} maxLength={2000} rows={5}
            value={message} onChange={e=>setMessage(e.target.value)} />
        </label>
        <div className="hidden" aria-hidden="true">
          <label>Company website
            <input tabIndex={-1} autoComplete="off" value={companyWebsite} onChange={e=>setCompanyWebsite(e.target.value)} />
          </label>
        </div>
        <label className="flex gap-3 text-sm leading-6 text-[#364152]">
          <input type="checkbox" required checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)} />
          <span>I have read the <Link className="font-bold underline" href="/privacy">Privacy Policy</Link> and understand
            my details will be used to respond to my business enquiry.</span>
        </label>
        <label className="flex gap-3 text-sm leading-6 text-[#364152]">
          <input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)} />
          <span>Optional: I would also like to receive relevant XDrive business updates.
            This does not bypass separate marketing eligibility checks.</span>
        </label>
        <button type="submit" disabled={busy||!!reference}
          className="w-fit rounded-md bg-[#F5A300] px-7 py-3 font-black text-[#0A234F] disabled:opacity-50">
          {busy?'Submitting…':reference?'Enquiry recorded':'Send business enquiry'}
        </button>
        {error&&<p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        {reference&&<p role="status" className="text-sm font-semibold text-green-800">
          Your request has been queued for review. Reference: {reference}. No marketing message has been sent.
        </p>}
      </form>
    </div>
  </section>;
}
