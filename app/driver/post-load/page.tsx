'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import LoadPostingForm from '../../components/workspace/LoadPostingForm';

/** 3150 canonical Post Load. The form is the approved 3150 component itself;
 * the authenticated Master shell supplies the only page heading and sidebar.
 * All persistence, Stripe, authorisation and validation stay in LoadPostingForm.
 */
export default function OwnerDriverPostLoadPage() {
  return <ProtectedRoute allowedRoles={['driver']}>
    <LoadPostingForm mode="owner" />
  </ProtectedRoute>;
}