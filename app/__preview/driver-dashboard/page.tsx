import { notFound } from 'next/navigation';
import '../../components/workspace/workspace-measured-cx-baseline.css';
import '../../driver/driver-operational.css';
import '../../driver/driver-dashboard-reference.css';
import './preview.css';
import DriverDashboardPreviewClient from './DriverDashboardPreviewClient';

export const metadata = { title: 'Driver Dashboard Visual Preview | XDrive Logistics', robots: { index: false, follow: false } };

export default function DriverDashboardVisualPreview() {
  const context = process.env.CONTEXT;
  if (process.env.NODE_ENV === 'production' && context !== 'deploy-preview' && context !== 'branch-deploy') notFound();
  return <DriverDashboardPreviewClient />;
}
