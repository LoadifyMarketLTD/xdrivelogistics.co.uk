'use client';

import { useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverJobExecutionPage from '../../../components/workspace/DriverJobExecutionPage';
import JobLiveTrackingPanel from '../../../components/tracking/JobLiveTrackingPanel';

export default function DriverJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? '';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <><DriverJobExecutionPage jobId={jobId} /><section aria-label="Live GPS tracking" style={{maxWidth:1200,margin:"0 auto",padding:"0 16px 24px"}}><JobLiveTrackingPanel jobId={jobId}/></section></>
    </ProtectedRoute>
  );
}
