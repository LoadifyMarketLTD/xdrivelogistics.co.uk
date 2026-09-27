import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pending Approval',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
