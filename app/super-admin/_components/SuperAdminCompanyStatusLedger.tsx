'use client';

import SuperAdminLiveTablePage from './SuperAdminLiveTablePage';
import PlatformEntityLink from './control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from './superAdminFormatters';

type CompanyRow = {
  id:string; name:string; company_number:string|null; email:string|null;
  status:string; company_type:string|null; created_at:string;
};
type Mode = 'active' | 'pending';
const config: Record<Mode,{title:string;description:string;empty:string}> = {
  active: { title:'Active Companies', description:'Currently active companies across the platform, with canonical status and direct inspection.', empty:'No active companies found.' },
  pending: { title:'Company Verification', description:'Companies awaiting verification or approval. Use the Approvals Queue for governed approve/reject actions.', empty:'No companies awaiting verification.' },
};

export default function SuperAdminCompanyStatusLedger({mode}:{mode:Mode}) {
  const copy=config[mode];
  return <SuperAdminLiveTablePage<CompanyRow>
    icon="company" title={copy.title} sectionLabel="Companies" description={copy.description}
    endpoint={`/api/super-admin/companies?status=${mode}`} rowsField="companies" pageSize={50}
    searchPlaceholder="Search company name, registration or email…" emptyMessage={copy.empty}
    columns={[
      { key:'company', label:'Company', render:(row)=><PlatformEntityLink entityType="company" entityId={row.id} compact>{row.name}</PlatformEntityLink> },
      { key:'registration', label:'Registration', render:(row)=>row.company_number??'—' },
      { key:'email', label:'Email', render:(row)=>row.email??'—' },
      { key:'type', label:'Type', render:(row)=>(row.company_type??'standard').replaceAll('_',' ') },
      { key:'status', label:'Status', render:(row)=><StatusChip value={row.status}/> },
      { key:'created', label:'Created', render:(row)=>formatDateTime(row.created_at) },
      { key:'inspect', label:'Inspect', render:(row)=><PlatformEntityLink entityType="company" entityId={row.id} compact>Open</PlatformEntityLink> },
    ]}
  />;
}
