'use client';
import { useParams } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import DriverJobExecutionPage from '../../../../components/workspace/DriverJobExecutionPage';

export default function FreshPodPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  return <ProtectedRoute allowedRoles={['driver']}>
    <main className="fresh-booking-execution">
      {id ? <DriverJobExecutionPage jobId={id} mobilePwa podOnly /> : <p>Booking reference missing.</p>}
    </main>
  </ProtectedRoute>;
}
