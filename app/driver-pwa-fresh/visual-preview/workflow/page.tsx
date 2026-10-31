'use client';

import { useSearchParams } from 'next/navigation';
import LoadsClient from '../../jobs/LoadsClient';
import FreshQuotes from '../../quotes/page';
import Bookings from '../../bookings/page';

/** The approved workflow URL now uses the actual authenticated driver data and lifecycle.
 * Quotes, awards, collection and POD must never be simulated in this entry point.
 */
export default function Workflow() {
  const tab = useSearchParams().get('tab');
  if (tab === 'quotes') return <FreshQuotes />;
  if (tab === 'bookings') return <Bookings />;
  return <LoadsClient />;
}