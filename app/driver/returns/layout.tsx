import type { ReactNode } from 'react';
import './returns-exchange.css';
import './return-toolbar-readability.css';

export default function DriverReturnsLayout({ children }: { children: ReactNode }) {
  return <div className="driver-returns-exchange driver-reference-page driver-reference-returns">{children}</div>;
}
