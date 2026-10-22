import Link from 'next/link';
import { COMPANY_CONFIG } from '../../../config/company';

export default function MobileDriverSupportPage() {
  return <section className="xd-mobile-list">
    <header>
      <Link href="/m/driver/more" className="xd-mobile-back">← More</Link>
      <h1>Help &amp; support</h1>
      <p>Help for your Driver PWA account, quotes and bookings</p>
    </header>
    <article className="xd-mobile-card">
      <h2>Contact XDrive</h2>
      <p>Include the job reference and the action you attempted when reporting a problem.</p>
      <div className="xd-mobile-actions">
        <a href={`mailto:${COMPANY_CONFIG.email}?subject=${encodeURIComponent('Driver PWA support')}`}>Email support</a>
        <a href={`tel:${COMPANY_CONFIG.phone}`}>Call {COMPANY_CONFIG.phoneDisplay}</a>
      </div>
      <p>Do not email passwords, authentication codes, full payment-card details or private customer documents.</p>
    </article>
    <article className="xd-mobile-card">
      <h2>Common questions</h2>
      <details>
        <summary>Why can I not submit a quote?</summary>
        <p>Your account, company and vehicle must meet marketplace requirements. The Jobs page shows restrictions beside the affected job. For company-controlled setup, contact your dispatcher or company administrator.</p>
      </details>
      <details>
        <summary>How do I complete a delivery?</summary>
        <p>Open Bookings, select your assigned job and follow each action in order. Record collection handover evidence, complete all stops and capture POD after delivery.</p>
      </details>
      <details>
        <summary>Who manages my documents?</summary>
        <p>You can inspect your required documents from More. Company vehicle assignments and approvals remain controlled by your company administrator.</p>
        <Link href="/m/driver/documents">Open documents</Link>
      </details>
      <details>
        <summary>What if a booking action fails?</summary>
        <p>Check your connection, reopen the booking to see its recorded status, and do not repeat the action until you have checked whether it was saved.</p>
      </details>
    </article>
    <Link href="/m/driver/more" className="xd-mobile-back">← Back to More</Link>
  </section>;
}
