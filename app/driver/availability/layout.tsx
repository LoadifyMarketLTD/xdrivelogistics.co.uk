import type { ReactNode } from 'react';
import './availability-exchange.css';

export default function DriverAvailabilityLayout({ children }: { children: ReactNode }) {
  return <div className="driver-reference-page driver-reference-availability">{children}</div>;
}
