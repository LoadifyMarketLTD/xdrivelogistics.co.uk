'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import LoadPostingForm from '../../components/workspace/LoadPostingForm';

/** Original 3150 Post Load form, without a second heading or wrapper. */
export default function AdminPostLoadPage() {
  return <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
    <LoadPostingForm mode="admin" />
  </ProtectedRoute>;
}