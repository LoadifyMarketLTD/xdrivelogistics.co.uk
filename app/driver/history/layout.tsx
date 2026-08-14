import type { ReactNode } from 'react';
import './diary-exchange.css';

export default function DriverDiaryLayout({ children }: { children: ReactNode }) {
  return <div className="driver-diary-route">{children}</div>;
}
