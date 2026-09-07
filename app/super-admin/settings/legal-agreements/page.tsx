'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  registration_role: string;
  legal_version: string;
  privacy_version: string;
  agreement_codes: string[];
  accepted_at: string;
  source: string;
  evidence_hash: string;
  company_name: string;
  user_name: string;
  user_email: string;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="§"
    title="Legal & Agreements"
    sectionLabel="Platform"
    description="Immutable platform acceptance evidence across contractual roles, versions and material re-acceptance events."
    endpoint="/api/super-admin/governance?section=legal-agreements"
    pageSize={50}
    emptyMessage="No legal acceptance evidence found."
    columns={[
      { key: 'account', label: 'Account', render: (row) => row.user_id ? <div><PlatformEntityLink entityType="user" entityId={row.user_id} compact>{row.user_name !== '—' ? row.user_name : row.user_email}</PlatformEntityLink><div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.user_email}</div></div> : '—' },
      { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : '—' },
      { key: 'role', label: 'Contractual role', render: (row) => <strong>{row.registration_role.replaceAll('_',' ')}</strong> },
      { key: 'versions', label: 'Versions', render: (row) => <div>Legal {row.legal_version}<div style={{fontSize:10,color:'#64748B',marginTop:3}}>Privacy {row.privacy_version}</div></div> },
      { key: 'agreements', label: 'Agreements', render: (row) => row.agreement_codes.length ? row.agreement_codes.join(', ') : '—' },
      { key: 'source', label: 'Evidence source', render: (row) => row.source.replaceAll('_',' ') },
      { key: 'accepted', label: 'Accepted', render: (row) => formatDateTime(row.accepted_at) },
      { key: 'hash', label: 'Evidence hash', render: (row) => <code style={{fontSize:10}}>{row.evidence_hash ? `${row.evidence_hash.slice(0,12)}…` : '—'}</code> },
    ]}
  />;
}
