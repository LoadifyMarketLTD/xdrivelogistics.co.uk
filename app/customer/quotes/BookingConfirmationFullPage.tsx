'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Image from 'next/image';
import { BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT } from '../../../lib/legal/paymentObligation';
import styles from './BookingConfirmationFullPage.module.css';
import BookingMasterShell from './BookingMasterShell';

export type BookingConfirmationDetails = {
  jobId: string;
  bidId?: string;
  amount: number;
  currency: string;
  pickup: string;
  delivery: string;
  pickupDate: string | null;
  deliveryDate: string | null;
  vehicle: string;
  pallets: number | null;
  tailLift: boolean;
  paymentTerms: string | null;
  carrierName: string;
  companyName: string | null;
  memberId: string | null;
  phone: string | null;
  availability: string | null;
  ownerDriver: boolean;
  message: string | null;
};

function displayDate(value: string | null) {
  if (!value) return 'Not specified';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? 'Not specified' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function BookingConfirmationFullPage({ details, working, onCancel, onConfirm }: {
  details: BookingConfirmationDetails;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [detailsAccepted, setDetailsAccepted] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  type QuoteIdentity = { bidId:string;driverId:string|null;quoteLevel:'driver'|'company';personName:string|null;companyName:string|null;displayName:string;businessPhone:string|null;memberId:string|null;driverAvailability:string|null;driverVehicleType:string|null;vehicleRegistration:string|null;quotedVehicleId:string|null;driverVehiclePallets:number|null;driverVehicleTailLift:boolean;driverDocumentStatuses:Record<string,string>;vehicleDocumentStatuses:Record<string,string>;complianceRetrieved:boolean };
  const [resolvedIdentity,setIdentity]=useState<QuoteIdentity|null>(null);
  // Never render or act on a bidder resolved for a different quote, even for one frame.
  const identity=resolvedIdentity?.bidId===details.bidId ? resolvedIdentity : null;
  const [identityState,setIdentityState]=useState<'loading'|'resolved'|'unavailable'>('loading');
  useEffect(()=>{
    setIdentity(null);
    setDetailsAccepted(false);
    setPaymentAccepted(false);
    setIdentityState(details.bidId ? 'loading' : 'unavailable');
    if(!details.bidId)return;
    let active=true;
    const resolve=async()=>{
      try{
        const {data:session}=await supabase.auth.getSession();
        if(!session.session?.access_token)throw new Error('Missing session');
        const response=await fetch('/api/workspace/bids/identities?bidId='+encodeURIComponent(details.bidId as string),{headers:{Authorization:'Bearer '+session.session.access_token},cache:'no-store'});
        if(!response.ok)throw new Error('Identity API unavailable');
        const body=await response.json() as {identities?:QuoteIdentity[]};
        if(active){setIdentity(body.identities?.find(row=>row.bidId===details.bidId)??null);setIdentityState('resolved');}
      }catch{if(active)setIdentityState('unavailable');}
    };
    void resolve();
    return()=>{active=false;};
  },[details.bidId]);
  const verifiedName=identity?.personName||identity?.companyName||details.carrierName;
  const publicDriverId = (identity?.memberId || details.memberId || '').match(/XD-\d{6}/i)?.[0]?.toUpperCase() || null;
  const pickupExpired=!details.pickupDate || !Number.isFinite(Date.parse(details.pickupDate)) || Date.parse(details.pickupDate)<=Date.now();
  const capacityMismatch=identity?.driverVehiclePallets!=null && details.pallets!=null && details.pallets>identity.driverVehiclePallets;
  const namedDriverQuote=identity?.quoteLevel==='driver' || details.ownerDriver;
  const vehicleUnverified=namedDriverQuote && (!identity?.quotedVehicleId || !identity?.driverId || identity?.driverVehiclePallets==null);
  const tailLiftMismatch=details.tailLift && namedDriverQuote && identity?.driverVehicleTailLift===false;
  const quoteVehicleMismatch=namedDriverQuote && identity?.quotedVehicleId!=null && identity?.vehicleRegistration==null;
  const verificationBlocked=identityState!=='resolved' || !identity || vehicleUnverified || quoteVehicleMismatch || tailLiftMismatch;
  const ready = detailsAccepted && paymentAccepted && !working && !pickupExpired && !capacityMismatch && !verificationBlocked;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !working) onCancel(); };
    document.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onEscape); };
  }, [onCancel, working]);

  const price = new Intl.NumberFormat('en-GB', { style: 'currency', currency: details.currency || 'GBP' }).format(details.amount);
  const compliance = [
    {label:'Driving licence',type:'driver',keys:['driving_licence','driving_license']},
    {label:'Driver insurance',type:'driver',keys:['hire_reward','insurance','driver_insurance']},
    {label:'Goods in Transit',type:'vehicle',keys:['goods_in_transit']},
    {label:'Vehicle insurance',type:'vehicle',keys:['vehicle_insurance','insurance']},
    {label:'MOT',type:'vehicle',keys:['mot','mot_certificate']},
    {label:'Identity verification',type:'driver',keys:['identity','proof_of_identity']},
  ];
  const docStatus=(item:typeof compliance[number])=>{
    if(identityState!=='resolved'||!identity?.complianceRetrieved)return 'Verification unavailable';
    const lookup=item.type==='driver'?identity.driverDocumentStatuses:identity.vehicleDocumentStatuses;
    return item.keys.map(key=>lookup[key]).find(Boolean)||'No linked record';
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Confirm booking offer">
      <BookingMasterShell onClose={onCancel}>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroTop}>
              <div className={styles.logo}><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={204} height={52} priority /></div>
              <span className={styles.ref}>REVIEW &amp; CONFIRM BOOKING OFFER · XDL-{details.jobId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className={styles.heroBottom}>
              <div>
                <div className={styles.eyebrow}>EXECUTIVE BOOKING CONFIRMATION</div>
                <h1 className={styles.routeHeading}>{details.pickup} <span>→</span> {details.delivery}</h1>
                <p>{details.vehicle}{details.tailLift ? ' · Tail-lift' : ''}{details.pallets != null ? ` · ${details.pallets} pallets` : ''}</p>
              </div>
              <div className={styles.quote}>
                <span>AGREED QUOTE</span>
                <strong>{price}</strong>
                <small>Carrier acceptance required</small>
              </div>
            </div>
          </div>
        </header>
        <main className={styles.content}>
          <div className={styles.topGrid}>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>↗</span><strong>Transport &amp; Schedule</strong><small>LOAD DETAILS</small></div>
              <div className={styles.dates}>
                <div><label>COLLECTION</label><strong>{displayDate(details.pickupDate)}</strong><span>{details.pickup}</span></div>
                <div><label>DELIVERY</label><strong>{displayDate(details.deliveryDate)}</strong><span>{details.delivery}</span></div>
              </div>
              <div className={styles.fact}><span>Vehicle</span><strong>{details.vehicle}</strong></div>
              <div className={styles.fact}><span>Cargo</span><strong>{details.pallets != null ? `${details.pallets} pallets` : 'See load details'}</strong></div>
              <div className={styles.fact}><span>Payment terms</span><strong>{details.paymentTerms || 'Refer to agreed booking terms'}</strong></div>
              <div className={styles.fact}><span>Offer status</span><strong>Draft — awaiting send</strong></div>
              {pickupExpired && <p className={styles.capacityWarning} role="alert">Collection time is in the past or missing. Update the load schedule before offering this transport.</p>}
            </section>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>♙</span><strong>Selected Transport Partner</strong><small>{details.ownerDriver ? 'OWNER DRIVER' : 'COMPANY / FLEET'}</small></div>
              <div className={styles.person}>
                <div className={styles.avatar} aria-hidden="true">{(verifiedName || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}</div>
                <div className={styles.personDetails}><strong>{verifiedName}</strong><span>{identity?.companyName || details.companyName || 'Company details unavailable'}</span><span>{identity?.memberId || details.memberId || 'Member ID unavailable'} · {identity?.businessPhone || details.phone || 'Phone unavailable'}</span></div>
                {(identity?.driverAvailability || details.availability) && <span className={styles.availability}>{(identity?.driverAvailability || details.availability || '').replaceAll('_', ' ')}</span>}
              </div>
              {verificationBlocked && <p className={styles.capacityWarning} role="alert">Bidder or quoted vehicle verification is unavailable. Booking cannot be sent until the selected quotation and vehicle are verified.</p>}
              <div className={styles.identityFacts}>
                <span>Quote profile</span><strong>{identity?.driverId ? 'Named driver linked to this quotation' : identity?.quoteLevel==='company' ? 'Company quote' : 'Bidder not yet verified'}</strong>
                <span>Driver ID</span><strong>{identity?.driverId ? (publicDriverId || 'Public Driver ID unavailable') : 'Not linked to quote'}</strong>
                <span>Vehicle</span><strong>{identity?.driverVehicleType?.replaceAll('_',' ') || details.vehicle}</strong>
                <span>Registration</span><strong>{identity?.vehicleRegistration || 'Not provided'}</strong>
                <span>Vehicle capacity</span><strong>{identity?.driverVehiclePallets != null ? `${identity.driverVehiclePallets} pallets` : 'Not recorded'}</strong>
                <span>Identity source</span><strong>{identityState==='loading' ? 'Retrieving from XDrive API' : identityState==='resolved' ? identity ? 'Resolved from quote records' : 'No matched bidder profile' : 'API unavailable'}</strong>
              </div>
              {capacityMismatch && <p className={styles.capacityWarning} role="alert">Capacity mismatch: this load requires {details.pallets} pallets, but the quoted driver&apos;s registered vehicle has capacity for {identity.driverVehiclePallets}. Confirm an appropriate vehicle before booking.</p>}
              {tailLiftMismatch && <p className={styles.capacityWarning} role="alert">Tail-lift required by the load, but the quoted vehicle is not recorded as tail-lift equipped. Select an eligible vehicle before booking.</p>}
              <p className={styles.help}>The selected driver and vehicle information is read from the bidder's linked XDrive records. No unverified rating or job history is displayed.</p>
              {details.message && <p className={styles.carrierMessage}><strong>Carrier message:</strong> {details.message}</p>}
            </section>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>♢</span><strong>Documents &amp; Compliance</strong><small>{identity?.complianceRetrieved ? 'DATABASE RECORDS' : 'STATUS UNAVAILABLE'}</small></div>
              <div className={styles.documents}>{compliance.map(item => <div className={styles.document} key={item.label}><strong>{item.label}</strong><span>{docStatus(item)}</span></div>)}</div>
              <p className={styles.help}>Only document status records linked to the quoted driver or vehicle are shown. Missing or unverified records are not approved.</p>
            </section>
          </div>
          <div className={styles.bottomGrid}>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>✓</span><strong>Collection &amp; Delivery Responsibility</strong><small>CUSTOMER / BROKER</small></div>
              <p className={styles.explain}>The Customer / Broker approving this booking must supply the carrier with <strong>complete, correct and up-to-date</strong> collection and delivery information upon booking acceptance, before collection, and communicate any changes promptly.</p>
              <div className={styles.checkList}>{['Full collection address', 'Full delivery address', 'Contact names & numbers', 'Confirmed dates & time windows', 'Cargo, access & handling details', 'References & site instructions'].map(t => <span key={t}>✓ <span>{t}</span></span>)}</div>
              <label className={styles.confirm}><input type="checkbox" checked={detailsAccepted} onChange={e => setDetailsAccepted(e.target.checked)} /><span>I confirm that my company is responsible for supplying all required full collection and delivery details.</span></label>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>§</span><strong>Payment &amp; Legal Agreement</strong><small>REQUIRED ACKNOWLEDGEMENT</small></div>
              <div className={styles.legal}><strong>Agreed price: {price}.</strong> Customer / Broker is responsible for paying the selected carrier under the agreed booking terms. A transport agreement is formed only when the carrier accepts this offer.</div>
              <p className={styles.explain}>{BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT}</p>
              <label className={styles.confirm}><input type="checkbox" checked={paymentAccepted} onChange={e => setPaymentAccepted(e.target.checked)} /><span>I acknowledge my company&apos;s obligation to pay the selected carrier under the agreed booking terms.</span></label>
              <p className={styles.help}>Sending the offer creates a pending carrier acceptance request, not an accepted booking.</p>
            </section>
          </div>
        </main>
        <footer className={styles.footer}>
          <span className={ready ? styles.ready : styles.notReady}>{ready ? '✓ Both acknowledgements completed' : 'Both acknowledgements required before sending'}</span>
          <div className={styles.actions}>
            <button type="button" onClick={onCancel} disabled={working} className={styles.cancel}>Cancel</button>
            <button type="button" onClick={onConfirm} disabled={!ready} className={styles.send}>{working ? 'Sending…' : 'Send Booking Offer →'}</button>
          </div>
        </footer>
      </div>
      </BookingMasterShell>
    </div>
  );
}
