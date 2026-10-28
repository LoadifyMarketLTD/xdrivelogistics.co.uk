import type { ReactNode } from 'react';
import './loads.css';
import './visual-standard.css';

export default function FreshDriverLayout({ children }: { children: ReactNode }) {
  return <div className="fresh-driver-pwa">{children}</div>;
}
