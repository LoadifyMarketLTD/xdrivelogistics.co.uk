import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';

const base = '/driver-pwa-fresh/visual-preview';
const steps = [
  base + '/workflow?tab=jobs',
  base + '/details?load=visual-1',
  base + '/quote?load=visual-1',
  base + '/workflow?tab=quotes',
  base + '/workflow?tab=quotes',
  base + '/workflow?tab=bookings',
  base + '/workflow/page-0',
  ...Array.from({length: 11}, (_, i) => base + '/workflow/page-' + (i + 1)),
] as const;

/** Canonical numbering starts at Loads=0, while preserving existing preview pages. */
export default async function CanonicalDriverStep({params}: {params: Promise<{step:string}>}) {
  const host = (await headers()).get('host') ?? '';
  if (process.env.NODE_ENV !== 'development' && !/^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host)) notFound();
  const {step} = await params;
  if (!/^(?:[0-9]|1[0-7])$/.test(step)) notFound();
  redirect(steps[Number(step)]);
}
