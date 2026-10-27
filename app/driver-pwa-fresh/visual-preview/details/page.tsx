import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

const samples: Record<string, { from: string; to: string; vehicle: string; weight: string; notes: string }> = {
  'visual-1': { from: 'ERITH DA8', to: 'BLACKBURN BB1', vehicle: 'LWB Van', weight: '375 kg', notes: 'LIVE SYSTEM TEST - DO NOT QUOTE OR BOOK. No transport is required.' },
  'visual-2': { from: 'BLACKBURN BB1', to: 'ERITH DA8', vehicle: 'LWB Van', weight: '375 kg', notes: 'Collection and delivery reference. Handle with care.' },
  'visual-3': { from: 'LONDON SE1', to: 'LUTON LU1', vehicle: 'LWB Van', weight: '375 kg', notes: 'Driver visual reference only. Not a real load.' },
};

export default async function DetailsVisualPreview({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const host = (await headers()).get('host') ?? '';
  if (process.env.NODE_ENV !== 'development' && !/^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host)) notFound();
  const { load } = await searchParams;
  const item = samples[load || ''];
  if (!item) notFound();
  return <>
    <header className="fresh-header"><Link className="fresh-back" href="/driver-pwa-fresh/visual-preview">Back to Jobs</Link><h1>Load Details</h1></header>
    <main className="fresh-content"><article className="fresh-card">
      <section className="fresh-summary"><div className="fresh-summary-top"><strong>XDRIVE LOGISTICS LTD</strong><span className="fresh-tag">Available</span></div><p className="fresh-muted">Sample load - visual preview only</p></section>
      <section className="fresh-route"><div className="fresh-stop"><span className="fresh-dot"/><div><div className="fresh-muted">COLLECTION</div><strong className="fresh-town">{item.from}</strong></div></div><div className="fresh-stop"><span className="fresh-dot"/><div><div className="fresh-muted">DELIVERY</div><strong className="fresh-town">{item.to}</strong></div></div></section>
      <section className="fresh-notes"><h2>Job Details</h2><dl className="fresh-facts"><dt>Vehicle</dt><dd>{item.vehicle}</dd><dt>Weight</dt><dd>{item.weight}</dd><dt>Payment terms</dt><dd>30 days</dd></dl></section>
      <section className="fresh-notes"><h2>Notes</h2><p>{item.notes}</p></section>
      <section className="fresh-actions"><Link className="quote-now" href={`/driver-pwa-fresh/visual-preview/quote?load=${encodeURIComponent(load || '')}`}>Quote Now</Link><p className="fresh-muted">Preview only. No booking or quote will be submitted.</p></section>
    </article></main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><Link className="selected" href="/driver-pwa-fresh/visual-preview">Jobs</Link><span aria-disabled="true">Quotes</span><span aria-disabled="true">Bookings</span><span aria-disabled="true">More</span></nav>
  </>;
}
