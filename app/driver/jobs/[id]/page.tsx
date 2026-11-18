'use client';

import { useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverJobExecutionPage from '../../../components/workspace/DriverJobExecutionPage';

export default function DriverJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? '';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverJobExecutionPage jobId={jobId} />
    </ProtectedRoute>
  );
}
