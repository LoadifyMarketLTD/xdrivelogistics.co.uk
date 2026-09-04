'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionButton,
  PageFrame,
  PageHeader,
} from '../../components/workspace/WorkspaceUI';

type AccountSection = 'settings' | 'team' | 'legal';

const sections: Array<{
  id: AccountSection;
  label: string;
  description: string;
}> = [
  {
    id: 'settings',
    label: 'Company Settings',
    description: 'Company profile and broker workspace configuration.',
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Broker users and company membership administration.',
  },
  {
    id: 'legal',
    label: 'Legal & Agreements',
    description: 'Accepted terms, versions and immutable legal evidence history.',
  },
];

export default function BrokerAccountPage() {
  const router = useRouter();
  const [section, setSection] = useState<AccountSection>('settings');
  const active = sections.find((item) => item.id === section) ?? sections[0];

  const openSection = () => {
    if (section === 'settings') return router.push('/broker/settings');
    if (section === 'team') return router.push('/broker/team');
    return router.push('/broker/account/legal-agreements');
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker administration"
        title="Account"
        description="Company administration is grouped under one compact account workspace."
      />

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Account sections">
          <div className="workspace-filter-rail__header">Account</div>
          <div className="workspace-filter-rail__body">
            {sections.map((item) => {
              const selected = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  style={{
                    width: '100%',
                    minHeight: 'var(--ws-control-h, 32px)',
                    padding: '0 8px',
                    border: `1px solid ${selected ? '#1d57d8' : '#cfd7e3'}`,
                    borderRadius: 'var(--ws-radius, 4px)',
                    background: selected ? '#eaf3ff' : '#fff',
                    color: selected ? '#0b3f9c' : '#172033',
                    textAlign: 'left',
                    fontSize: 'var(--ws-font-label, 11px)',
                    lineHeight: '15px',
                    fontWeight: selected ? 800 : 700,
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <section className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}>
            <div className="workspace-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <strong>{active.label}</strong>
                <div style={{ color: '#64748b', marginTop: 2, fontSize: 'var(--ws-font-meta, 11px)', lineHeight: '15px' }}>{active.description}</div>
              </div>
              <ActionButton tone="primary" onClick={openSection}>
                Open {section === 'settings' ? 'settings' : section === 'team' ? 'team' : 'Legal & Agreements'}
              </ActionButton>
            </div>
            <div style={{ padding: 8, color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)', lineHeight: '15px' }}>
              {section === 'settings'
                ? 'The existing Settings module remains the source of truth for broker company configuration. No settings are duplicated in this account hub.'
                : section === 'team'
                  ? 'The existing Team module remains connected to the company membership workflow. Account only provides the shared navigation entry point.'
                  : 'Legal & Agreements shows the authenticated account’s accepted contractual package and immutable evidence history. Re-acceptance is offered only when the server identifies a material change.'}
            </div>
          </section>
        </main>
      </div>
    </PageFrame>
  );
}
