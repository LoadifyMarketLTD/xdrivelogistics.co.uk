'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';
import Link from 'next/link';
export default function DriverFleetPage(){
 return <ProtectedRoute allowedRoles={['driver']}>
  <MemberFleetOverview section="fleet" />
  <nav className="master3150-real-fleet-controls" aria-label="Fleet tools"><Link href="/driver/vehicles">Vehicle registration and documents</Link><Link href="/driver/availability">Live availability and locations</Link></nav>
 </ProtectedRoute>;
}
