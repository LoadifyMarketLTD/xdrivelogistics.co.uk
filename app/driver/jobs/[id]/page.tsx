'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import { resolveWorkspaceRole } from '../../../../lib/workspaceRole';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverJobExecutionPage from '../../../components/workspace/DriverJobExecutionPage';
import JobLiveTrackingPanel from '../../../components/tracking/JobLiveTrackingPanel';

export default function DriverJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? '';
  const {user}=useAuth();
  const ownerWeb=resolveWorkspaceRole(user)==='owner_driver';

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      {ownerWeb ? <div className="xd-owner-pr807" style={{display:'contents'}}><DriverJobExecutionPage key={jobId} jobId={jobId}/></div> : <><DriverJobExecutionPage jobId={jobId}/><section aria-label="Live GPS tracking" style={{maxWidth:1200,margin:"0 auto",padding:"0 16px 24px"}}><JobLiveTrackingPanel jobId={jobId}/></section></>}
    </ProtectedRoute>
  );
}
