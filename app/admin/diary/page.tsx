'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import OperationsDiaryPage from '../../components/workspace/OperationsDiaryPage';

export default function DiaryPage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <OperationsDiaryPage />
    </ProtectedRoute>
  );
}
