'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberOperationalReports from '../../components/workspace/MemberOperationalReports';
/** Company Driver and Owner Driver see only jobs/bids permitted by driver RLS.
 * Invoice totals show Unavailable when driver invoice SELECT is not authorised.
 */
export default function DriverReportsPage(){return <ProtectedRoute allowedRoles={['driver']}><MemberOperationalReports role="carrier" includeDriverFinance/></ProtectedRoute>;}
