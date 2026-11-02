import type { ReactNode } from 'react';

export default function DriverVehiclesLayout({ children }: { children: ReactNode }) {
  return <div className="driver-reference-page driver-reference-account">{children}</div>;
}
