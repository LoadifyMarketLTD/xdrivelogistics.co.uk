'use client';
import ProtectedRoute from '../components/ProtectedRoute';
import { BrokerDashboard } from './BrokerWorkspaceModules';
export default function BrokerHomePage(){return <ProtectedRoute allowedRoles={['broker','owner']}><BrokerDashboard/></ProtectedRoute>}
