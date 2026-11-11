'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberOperationalReports from '../../components/workspace/MemberOperationalReports';
export default function CarrierReportsPage() { return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><MemberOperationalReports role="carrier" /></ProtectedRoute>; }
