import type { ReactNode } from 'react';
import './quotes-exchange.css';

export default function DriverQuotesLayout({ children }: { children: ReactNode }) {
  return <div className="driver-quotes-exchange driver-reference-page driver-reference-quotes">{children}</div>;
}
