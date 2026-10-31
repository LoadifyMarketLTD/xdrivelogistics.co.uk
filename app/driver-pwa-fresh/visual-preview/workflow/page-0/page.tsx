'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {readDemo,updateDemo} from '../../../demoState';
import {FreshBottom,FreshHeader} from '../../../FreshNavigation';

export default function BookingAcceptancePreviewPage(){
  const [details,setDetails]=useState(false);
  const router=useRouter();
  const accept=()=>{const previous=readDemo()['visual-1'];updateDemo('visual-1',{...previous,stage:'received',events:[...(previous?.events||[]),{stage:'received',at:new Date().toISOString()}]});router.push('/driver-pwa-fresh/visual-preview/workflow/page-1');};
  return <main className="fresh-driver-pwa">
    <FreshHeader title="Accept Job" inlineTitle/>
    <section className="fresh-content fresh-accept-page">
      <article className="fresh-card fresh-accept-card">
        <section className="fresh-accept-summary">
          <strong>E2E Collection</strong>
          <span>Load ID: XDL-2026-00128</span>
          <b>Acceptance Required</b>
        </section>

        <section className="fresh-accept-route">
          <div className="fresh-accept-route-icons" aria-hidden="true"><span>🚚</span><i>•<br/>•<br/>•</i><span>🚚</span></div>
          <div className="fresh-accept-route-places">
            <div><strong>BLACKBURN, BB1</strong><span>28 Oct · 09:00–10:00</span></div>
            <div><strong>MANCHESTER, M2</strong><span>28 Oct · ASAP</span></div>
          </div>
        </section>

        <section className="fresh-accept-facts">
          <div><b>Stops:</b><span>1</span></div>
          <div><b>Distance:</b><span>52.00 miles</span></div>
          <div><b>Notes:</b><span>Handle with care. Direct delivery.</span></div>
        </section>

        {details?<section className="fresh-accept-details" data-testid="page-zero-preview-details">
          <div><b>Vehicle</b><span>LWB Van</span></div>
          <div><b>Payment terms</b><span>30 Days EOM</span></div>
          <div><b>Booking ref</b><span>XDL-2026-00128</span></div>
          <div><b>Agreed quote</b><span>£240.00</span></div>
        </section>:null}

        <div className="fresh-accept-actions">
          <Link className="fresh-accept-map" href="/driver-pwa-fresh/visual-preview/map?load=visual-1">Map</Link>
          <button type="button" className="fresh-accept-details-button" aria-expanded={details} onClick={()=>setDetails(value=>!value)}>{details?'Hide Details':'View Details'}</button>
          <Link className="fresh-accept-decline" href="/driver-pwa-fresh/visual-preview/workflow?tab=bookings">Decline</Link>
          <button type="button" className="fresh-accept-confirm" onClick={accept}>Accept</button>
        </div>
      </article>
    </section>
    <FreshBottom active="bookings" demo/>
  </main>;
}
