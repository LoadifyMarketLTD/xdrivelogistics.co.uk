'use client';

import { usePathname, useRouter } from 'next/navigation';
import WorkspaceTabs from '../../components/workspace/WorkspaceTabs';

const TABS = [
  { id: '/broker', label: 'Dashboard' },
  { id: '/broker/loads', label: 'Load Board' },
  { id: '/broker/bids', label: 'My Bids' },
  { id: '/broker/awards', label: 'Awards' },
];

export default function BrokerWorkspaceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = TABS.find((tab) => tab.id !== '/broker' && pathname.startsWith(tab.id))?.id ?? '/broker';

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: '1rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem', overflowX: 'auto' }}>
      <button onClick={() => router.push('/broker')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
        <span style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'grid', placeItems: 'center', background: '#1d4ed8', color: '#ffffff', fontWeight: 900 }}>X</span>
        <span style={{ color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap' }}>Broker Workspace</span>
      </button>
      <WorkspaceTabs tabs={TABS} activeTab={activeTab} onTabChange={(href) => router.push(href)} />
    </header>
  );
}
