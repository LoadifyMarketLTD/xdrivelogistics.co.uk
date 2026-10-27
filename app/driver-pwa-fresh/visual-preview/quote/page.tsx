import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

const samples: Record<string, { from: string; to: string; vehicle: string }> = {
  'visual-1': { from: 'ERITH DA8', to: 'BLACKBURN BB1', vehicle: 'LWB Van' },
  'visual-2': { from: 'BLACKBURN BB1', to: 'ERITH DA8', vehicle: 'LWB Van' },
  'visual-3': { from: 'LONDON SE1', to: 'LUTON LU1', vehicle: 'LWB Van' },
};

export default async function QuoteVisualPreview({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const host = (await headers()).get('host') ?? '';
  if (process.env.NODE_ENV !== 'development' && !/^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host)) notFound();
  const { load } = await searchParams;
  const item = samples[load || ''];
  if (!item) notFound();
  return <>
    <header className="fresh-header"><Link className="fresh-back" href="/driver-pwa-fresh/visual-preview">Back to Jobs</Link><h1>Quote Now</h1></header>
    <main className="fresh-content"><article className="fresh-card">
      <section className="fresh-summary"><strong>Visual preview only</strong><p className="fresh-muted">Sample load — no real quote will be sent.</p></section>
      <section className="fresh-route"><div className="fresh-stop"><span className="fresh-dot"/><strong>{item.from}</strong></div><div className="fresh-stop"><span className="fresh-dot"/><strong>{item.to}</strong></div></section>
      <section className="fresh-notes"><h2>Vehicle</h2><p>{item.vehicle}</p></section>
      <section className="fresh-actions"><label>Quote amount (£)<input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Enter your quote" /></label><label>Message<textarea placeholder="Message to customer" /></label><p role="status">This is a design preview. Sign in to the real Jobs page to submit a quote.</p><Link className="fresh-detail" href="/driver-pwa-fresh/jobs">Open live Jobs</Link></section>
    </article></main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><Link className="selected" href="/driver-pwa-fresh/visual-preview">Jobs</Link><span aria-disabled="true">Quotes</span><span aria-disabled="true">Bookings</span><span aria-disabled="true">More</span></nav>
  </>;
}
