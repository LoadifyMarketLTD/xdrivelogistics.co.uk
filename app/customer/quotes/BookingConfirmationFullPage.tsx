'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT } from '../../../lib/legal/paymentObligation';
import styles from './BookingConfirmationFullPage.module.css';

export type BookingConfirmationDetails = {
  jobId: string;
  amount: number;
  currency: string;
  pickup: string;
  delivery: string;
  pickupDate: string | null;
  deliveryDate: string | null;
  vehicle: string;
  pallets: number | null;
  vehicleCapacityPallets?: number | null;
  loadWeightKg?: number | null;
  tailLift: boolean;
  paymentTerms: string | null;
  carrierName: string;
  companyName: string | null;
  memberId: string | null;
  phone: string | null;
  availability: string | null;
  memberSince?: string | null;
  completedJobs?: number | null;
  customerRating?: number | null;
  documentStatuses?: Array<{ name: string; status: string; expiryDate: string | null }>;
  ownerDriver: boolean;
  message: string | null;
};

function displayDate(value: string | null) {
  if (!value) return 'Not specified';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? 'Not specified' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function BookingConfirmationFullPage({ details, working, error, onCancel, onConfirm }: {
  details: BookingConfirmationDetails;
  working: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [detailsAccepted, setDetailsAccepted] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [availabilityAcknowledged, setAvailabilityAcknowledged] = useState(false);
  const ready = detailsAccepted && paymentAccepted && availabilityAcknowledged && !working;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !working) onCancel(); };
    document.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onEscape); };
  }, [onCancel, working]);

  const price = new Intl.NumberFormat('en-GB', { style: 'currency', currency: details.currency || 'GBP' }).format(details.amount);
  const compliance = ['Driving licence', 'Driver insurance', 'Goods in Transit', 'Vehicle insurance', 'MOT', 'Identity verification'];

  const documents = details.documentStatuses ?? [];
  const documentFor = (label: string) => {
    const match = (scope: string, term: RegExp) => documents.find((doc) => doc.name.toLowerCase().startsWith(scope.toLowerCase() + ' · ') && term.test(doc.name.toLowerCase()));
    if (label === 'Driving licence') return match('Driver', /driving licence|driving license/);
    if (label === 'Driver insurance') return match('Driver', /insurance|hire.*reward/);
    if (label === 'Goods in Transit') return documents.find((doc) => /goods.in.transit|\bgit\b/i.test(doc.name));
    if (label === 'Vehicle insurance') return match('Vehicle', /insurance/);
    if (label === 'MOT') return match('Vehicle', /\bmot\b/);
    if (label === 'Identity verification') return match('Driver', /identity|right.to.work|passport/);
    return undefined;
  };
  const documentStatusText = (doc?: {status:string;expiryDate:string|null}) => doc ?
    (doc.status + (doc.expiryDate ? ' · Expires ' + doc.expiryDate : '')) : 'No matching verification record';
  const mappedDocuments = new Set(compliance.map((name) => documentFor(name)?.name).filter(Boolean));
  const otherDocuments = documents.filter((doc) => !mappedDocuments.has(doc.name));

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Confirm booking offer">
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroTop}>
              <div className={styles.logo}><Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={204} height={52} priority /></div>
              <span className={styles.ref}>REVIEW &amp; CONFIRM BOOKING OFFER · XDL-{details.jobId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className={styles.heroBottom}>
              <div>
                <div className={styles.eyebrow}>EXECUTIVE BOOKING CONFIRMATION</div>
                <h1>{details.pickup} <span>→</span> {details.delivery}</h1>
                <p>{details.vehicle.replace(/\b\w/g, letter => letter.toUpperCase())}{details.tailLift && !/tail[\s_-]*lift/i.test(details.vehicle) ? ' · Tail-lift' : ''}{details.pallets != null ? ` · ${details.pallets} pallets` : ''}</p>
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
              <div className={styles.fact}><span>Vehicle</span><strong>{details.vehicle.replace(/\b\w/g, letter => letter.toUpperCase())}</strong></div>
              <div className={styles.fact}><span>Cargo</span><strong>{details.pallets != null ? `${details.pallets} pallets` : 'Pallet quantity not supplied'}</strong></div>

              {details.loadWeightKg != null && <div className={styles.fact}><span>Load weight</span><strong>{details.loadWeightKg} kg</strong></div>}

              {details.vehicleCapacityPallets != null && <div className={styles.fact}><span>Vehicle capacity</span><strong>Up to {details.vehicleCapacityPallets} pallets</strong></div>}
              <div className={styles.fact}><span>Payment terms</span><strong>{details.paymentTerms || 'Refer to agreed booking terms'}</strong></div>
              <div className={styles.fact}><span>Offer status</span><strong>Awaiting send</strong></div>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>♙</span><strong>Selected Transport Partner</strong><small>{details.ownerDriver ? 'OWNER DRIVER' : 'COMPANY / FLEET'}</small></div>
              <div className={styles.person}>
                <div className={styles.avatar} aria-hidden="true">{(details.carrierName || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}</div>
                <div className={styles.personDetails}><strong>{details.carrierName}</strong><span>{details.companyName || 'Company details unavailable'}</span><span>{details.memberId || 'Member ID unavailable'} · {details.phone || 'Phone unavailable'}</span></div>
                {details.availability && <span className={styles.availability}>{details.availability.replaceAll('_', ' ')}</span>}
              </div>
              <div className={styles.metrics}>
                <div><strong>{details.memberSince ? new Date(details.memberSince).toLocaleDateString('en-GB', {month:'short',year:'numeric'}) : 'Not available'}</strong><span>Member since</span></div>
                <div><strong>{details.completedJobs ?? 'Not available'}</strong><span>Completed jobs</span></div>
                <div><strong>{details.customerRating != null ? details.customerRating.toFixed(1) + ' / 5' : 'Not rated'}</strong><span>Customer rating</span></div>
              </div>
              <p className={styles.help}>Member history, completed jobs and ratings are shown only when verified XDrive records are available. No rating is assumed.</p>
              {details.message && <p className={styles.carrierMessage}><strong>Carrier message:</strong> {details.message}</p>}
            </section>
            <section className={styles.panel}>
              <div className={styles.panelTitle}><span className={styles.icon}>♢</span><strong>Documents &amp; Compliance</strong><small>RECORDS FROM XDRIVE</small></div>
              <div className={styles.documents}>{compliance.map(name => <div className={styles.document} key={name}><strong>{name}</strong><span>{documentStatusText(documentFor(name))}</span></div>)}{otherDocuments.map(doc => <div className={styles.document} key={doc.name}><strong>{doc.name}</strong><span>{documentStatusText(doc)}</span></div>)}</div>
              <p className={styles.help}>Document status reflects available verification records, including expiry dates. Missing or unverified records are never assumed approved.</p>
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
          <section className={styles.panel} style={{ marginTop: 14 }}>
            <div className={styles.panelTitle}><strong>Carrier Availability &amp; Booking Acceptance</strong><small>REQUIRED ACKNOWLEDGEMENT</small></div>
            <p className={styles.explain}>
              The selected carrier may have submitted quotations for other transport jobs and may have accepted another booking since submitting this quotation.
              If availability has not been confirmed directly with the carrier, including by telephone where appropriate, I understand that the carrier may already be committed to other work.
              Sending this booking offer does not guarantee the carrier&apos;s current availability or constitute acceptance by the carrier.
              The transport remains subject to confirmation by an authorised representative of the carrier.
            </p>
            <label className={styles.confirm}>
              <input type="checkbox" checked={availabilityAcknowledged} onChange={event => setAvailabilityAcknowledged(event.target.checked)} />
              <span>I understand that this offer requires carrier acceptance and that the carrier may no longer be available.</span>
            </label>
          </section>
        </main>
        <footer className={styles.footer}>
          <div>
            <span className={ready ? styles.ready : styles.notReady}>{ready ? '✓ All three acknowledgements completed' : 'All three acknowledgements required before sending'}</span>
            {error && <p role="alert" style={{ color: '#b91c1c', margin: '4px 0 0', fontSize: 11 }}>{error}</p>}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={onCancel} disabled={working} className={styles.cancel}>Cancel</button>
            <button type="button" onClick={onConfirm} disabled={!ready} className={styles.send}>{working ? 'Sending…' : 'Send Booking Offer →'}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
