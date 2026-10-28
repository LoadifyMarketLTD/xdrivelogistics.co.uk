'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import DriverJobExecutionPage from '../../../../components/workspace/DriverJobExecutionPage';

// Mobile-only POD route; authoritative status and evidence remain on existing APIs.
export default function FreshPodPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  return <ProtectedRoute allowedRoles={['driver']}>
    <header className="fresh-booking-detail-header">
      <Link href={'/driver-pwa-fresh/bookings/' + encodeURIComponent(id)} aria-label="Back to booking">Back to booking</Link>
      <strong>Proof of Delivery</strong>
    </header>
    <main className="fresh-booking-execution">
      {id ? <DriverJobExecutionPage jobId={id} mobilePwa podOnly /> : <p>Booking reference missing.</p>}
    </main>
  </ProtectedRoute>;
}
