import { Suspense } from 'react';
import VehicleReadinessRecovery from '../../components/workspace/VehicleReadinessRecovery';
export default function Page(){return <Suspense fallback={<p>Loading vehicle recovery...</p>}><VehicleReadinessRecovery /></Suspense>;}
