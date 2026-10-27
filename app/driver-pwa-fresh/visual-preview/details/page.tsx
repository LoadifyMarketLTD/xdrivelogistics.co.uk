import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

type Sample = { from: string; to: string; vehicle: string; weight: string; cargo: string; dimensions: string; packaging: string; terms: string; pickup: string; delivery: string; notes: string; customer: string; distance: string; };
const samples: Record<string, Sample> = {
  'visual-1': { from: 'ERITH DA8', to: 'BLACKBURN BB1', vehicle: 'LWB Van', weight: '375 kg', cargo: 'Box', dimensions: '218 L x 138 W x 139 H cm', packaging: '1 crate', terms: '30 days (from invoice)', pickup: '26 Oct 2026, 10:00', delivery: '2 Nov 2026, 10:00', notes: 'LIVE SYSTEM TEST - DO NOT QUOTE OR BOOK. No transport is required. This is a test placeholder only.', customer: 'XDRIVE LOGISTICS LTD', distance: 'Not available' },
  'visual-2': { from: 'BLACKBURN BB1', to: 'ERITH DA8', vehicle: 'LWB Van', weight: '375 kg', cargo: 'Box', dimensions: '218 L x 138 W x 139 H cm', packaging: '1 crate', terms: '30 days (from invoice)', pickup: '26 Oct 2026, 10:00', delivery: '2 Nov 2026, 10:00', notes: 'Collection and delivery reference. Handle with care.', customer: 'XDRIVE LOGISTICS LTD', distance: 'Not available' },
  'visual-3': { from: 'LONDON SE1', to: 'LUTON LU1', vehicle: 'LWB Van', weight: '375 kg', cargo: 'Box', dimensions: 'Not specified', packaging: 'Not specified', terms: '30 days (from invoice)', pickup: 'ASAP', delivery: 'Not specified', notes: 'Driver visual reference only. Not a real load.', customer: 'XDRIVE LOGISTICS LTD', distance: 'Not available' },
};
export default async function DetailsVisualPreview({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const host = (await headers()).get('host') ?? '';
  if (process.env.NODE_ENV !== 'development' && !/^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host)) notFound();
  const { load } = await searchParams;
  const item = samples[load || ''];
  if (!item) notFound();
  return <>
    <header className="fresh-header fresh-preview-details-header"><Link className="fresh-back" href="/driver-pwa-fresh/visual-preview" aria-label="Back to Jobs">‹</Link><h1>Load Details</h1><span aria-hidden="true">☏</span></header>
    <main className="fresh-content fresh-preview-details">
      <article className="fresh-card">
        <section className="fresh-preview-route-overview"><div className="fresh-preview-pin">● <strong>{item.from}</strong><small>Collection · {item.pickup}</small></div><div className="fresh-preview-route-dots" aria-hidden="true">● · · · · · · · · · ●</div><div className="fresh-preview-pin delivery">● <strong>{item.to}</strong><small>Delivery · {item.delivery}</small></div><div className="fresh-preview-map-note">Map and journey time unavailable for this sample — no verified coordinates</div></section>
        <section className="fresh-preview-data"><dl><dt>Veh:</dt><dd>{item.vehicle}</dd><dt>Dist:</dt><dd>{item.distance}</dd><dt>Load:</dt><dd>{item.cargo}</dd><dt>Weight:</dt><dd>{item.weight}</dd><dt>Packaging:</dt><dd>{item.packaging}</dd><dt>Dims:</dt><dd>{item.dimensions}</dd></dl></section>
        <section className="fresh-preview-customer"><div><strong>Customer</strong><p>{item.customer}</p></div><div><strong>Terms:</strong><p>{item.terms}</p></div><div><strong>Tel:</strong><p>Not available in sample</p></div></section>
        <section className="fresh-preview-notes"><strong>Notes:</strong><p>{item.notes}</p></section>
        <section className="fresh-preview-feedback"><strong>Feedback (past 90 days)</strong><p>Not available in sample</p></section>
        <section className="fresh-actions"><Link className="quote-now" href={`/driver-pwa-fresh/visual-preview/quote?load=${encodeURIComponent(load || '')}`}>Quote Now</Link><div className="fresh-preview-secondary"><button disabled type="button">SAVE</button><button disabled type="button">DELETE</button></div><p className="fresh-muted">Visual preview only. SAVE and DELETE are not available for sample loads.</p></section>
      </article>
    </main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><Link className="selected" href="/driver-pwa-fresh/visual-preview">Jobs</Link><span aria-disabled="true">Quotes</span><span aria-disabled="true">Bookings</span><span aria-disabled="true">More</span></nav>
  </>;
}
