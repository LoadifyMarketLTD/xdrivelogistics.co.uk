'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
};

const GLOBAL_SETTINGS = [
  {
    group: 'Platform Identity',
    settings: [
      { key: 'platform_name', label: 'Platform Name', value: 'XDrive Logistics', type: 'text' },
      { key: 'platform_domain', label: 'Primary Domain', value: 'xdrivelogistics.co.uk', type: 'text' },
      { key: 'support_email', label: 'Support Email', value: 'support@xdrivelogistics.co.uk', type: 'text' },
      { key: 'default_currency', label: 'Default Currency', value: 'GBP', type: 'text' },
      { key: 'default_timezone', label: 'Default Timezone', value: 'Europe/London', type: 'text' },
    ],
  },
  {
    group: 'Marketplace Rules',
    settings: [
      { key: 'min_bid_interval_minutes', label: 'Min Bid Interval (minutes)', value: '5', type: 'number' },
      { key: 'max_bids_per_job', label: 'Max Bids per Job', value: '25', type: 'number' },
      { key: 'exchange_auto_expire_hours', label: 'Exchange Job Auto-Expire (hours)', value: '72', type: 'number' },
      { key: 'vat_rate_default_pct', label: 'Default VAT Rate (%)', value: '20', type: 'number' },
    ],
  },
  {
    group: 'Compliance',
    settings: [
      { key: 'doc_expiry_warning_days', label: 'Document Expiry Warning (days)', value: '30', type: 'number' },
      { key: 'compliance_block_posting', label: 'Block Posting on Compliance Failure', value: 'true', type: 'boolean' },
      { key: 'driver_doc_required', label: 'Required Driver Docs', value: 'driving_licence, cpc_card, insurance', type: 'text' },
      { key: 'vehicle_doc_required', label: 'Required Vehicle Docs', value: 'mot, insurance', type: 'text' },
    ],
  },
  {
    group: 'Onboarding',
    settings: [
      { key: 'company_approval_required', label: 'Company Approval Required', value: 'true', type: 'boolean' },
      { key: 'invite_email_provider', label: 'Invite Email Provider', value: 'Supabase Auth', type: 'text' },
      { key: 'default_company_status', label: 'New Company Default Status', value: 'pending_approval', type: 'text' },
    ],
  },
];

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>⚙️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Global Platform Settings</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Settings</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Global controls and platform-wide configuration defaults. Dynamic editing in next release.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {GLOBAL_SETTINGS.map((group) => (
            <div key={group.group} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${THEME.cardBorder}`, backgroundColor: '#0b1220' }}>
                <h3 style={{ color: THEME.accent, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  {group.group}
                </h3>
              </div>
              <div style={{ padding: '0.25rem 0' }}>
                {group.settings.map((setting) => (
                  <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: `1px solid rgba(51,65,85,0.4)` }}>
                    <div>
                      <div style={{ color: THEME.text, fontSize: '0.82rem', fontWeight: 500 }}>{setting.label}</div>
                      <div style={{ color: '#475569', fontSize: '0.68rem', fontFamily: 'monospace', marginTop: '0.1rem' }}>{setting.key}</div>
                    </div>
                    <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '6px', padding: '0.3rem 0.75rem', color: THEME.text, fontSize: '0.82rem', fontFamily: setting.type === 'text' ? 'inherit' : 'monospace', minWidth: '120px', textAlign: 'right' }}>
                      {setting.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
