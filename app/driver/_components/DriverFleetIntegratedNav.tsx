'use client';

import { useAuth } from '../../components/AuthContext';
import DriverIntegratedNav from './DriverIntegratedNav';

const OWNER_FLEET_ITEMS = [
  { href: '/driver/fleet', label: 'Fleet Availability' },
  { href: '/driver/vehicles', label: 'Vehicles' },
  { href: '/driver/drivers-vehicles', label: 'Drivers & Vehicles' },
  { href: '/driver/freight-vision', label: 'Tracking' },
];

export default function DriverFleetIntegratedNav() {
  const { user } = useAuth();
  if (user?.ownerDriverWorkspace !== true) return null;
  return <DriverIntegratedNav label="My Fleet workspace" items={OWNER_FLEET_ITEMS} />;
}
