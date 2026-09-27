import type { Metadata } from 'next';
import './register-responsive.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create Account',
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <div className="register-responsive-shell">{children}</div>;
}
