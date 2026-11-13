const fs=require('fs');
const p='app/components/workspace/RoleSettingsWorkspace.tsx';
let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const one=(a,b)=>{const n=s.split(a).length-1;if(n!==1)throw Error('Expected 1 marker got '+n+': '+a.slice(0,75));s=s.replace(a,b);};
one('  const nav = useMemo(() => [',
  "  // Stable Owner Driver categories: membership controls permissions, not item count.\n"+
  "  const ownerNav = [\n"+
  "    { label: 'My Profile', action: () => setSection('overview'), active: section === 'overview' || section === 'profile' },\n"+
  "    { label: 'Company Settings', action: () => setSection('company'), active: section === 'company' || section === 'finance' },\n"+
  "    { label: 'Operations', action: () => setSection('operations'), active: section === 'operations' || section === 'blocked' },\n"+
  "    { label: 'Security', action: () => setSection('security'), active: section === 'security' },\n"+
  "    { label: 'Billing & Membership', action: () => router.push('/driver/settings/billing'), active: false },\n"+
  "    { label: 'Legal & Agreements', action: () => router.push('/driver/account/legal-agreements'), active: false },\n"+
  "  ];\n"+
  "  const nav = useMemo(() => [");
one('  return (\n    <PageFrame>','  const displayedNav = role === \'owner\' ? ownerNav : nav;\n\n  return (\n    <PageFrame>');
one('          {nav.map((item) => (','          {displayedNav.map((item) => (');
one('<div className="role-settings-company">\n            <strong>{companyDisplay}</strong>',
'<div className="role-settings-company">\n            <strong>{role === \'owner\' ? \'Account settings\' : companyDisplay}</strong>');
one('title="Settings"\n        description=','title={role === \'owner\' ? \'Account settings\' : \'Settings\'}\n        description=');
one('              </Panel>\n            </div>\n          ) : section === \'company\' ? (',
"                {role === 'owner' && <div className=\"role-settings-actions\"><ActionButton tone=\"secondary\" onClick={() => setSection('profile')}>Edit profile</ActionButton></div>}\n"+
"              </Panel>\n            </div>\n          ) : section === 'company' ? (");
one("              {canEditCompany && <CompanyDepartmentsPanel companyId={company.id} />}",
"              {role === 'owner' && <div className=\"role-settings-actions\"><ActionButton tone=\"secondary\" disabled={!canManageBilling} onClick={() => setSection('finance')}>Company finance settings</ActionButton></div>}\n"+
"              {canEditCompany && <CompanyDepartmentsPanel companyId={company.id} />}");
one("          ) : section === 'operations' && companyOperationsVisible ? (\n            <CompanyOperationsSettingsPanel companyId={company.id} companyName={companyDisplay} />",
"          ) : section === 'operations' ? (\n"+
"            companyOperationsVisible ? <div className=\"role-settings-subsection\"><CompanyOperationsSettingsPanel companyId={company.id} companyName={companyDisplay} />"+
"<div className=\"role-settings-actions\"><ActionButton tone=\"secondary\" onClick={() => setSection('blocked')}>Blocked members</ActionButton></div></div>"+
" : <Panel title=\"Company operations\"><EmptyState compact title=\"Owner or administrator permission required\" /></Panel>");
one("          ) : section === 'blocked' && companyOperationsVisible ? (\n            <CompanyBlockedMembersPanel companyId={company.id} />",
"          ) : section === 'blocked' && companyOperationsVisible ? (\n"+
"            <div className=\"role-settings-subsection\"><div className=\"role-settings-actions\"><ActionButton tone=\"secondary\" onClick={() => setSection('operations')}>Back to operations</ActionButton></div><CompanyBlockedMembersPanel companyId={company.id} /></div>");
one("          ) : section === 'finance' && canManageBilling ? (\n            <CompanyFinanceSettingsPanel companyId={company.id} companyName={companyDisplay} />",
"          ) : section === 'finance' ? (\n"+
"            canManageBilling ? <div className=\"role-settings-subsection\"><div className=\"role-settings-actions\"><ActionButton tone=\"secondary\" onClick={() => setSection('company')}>Back to company settings</ActionButton></div><CompanyFinanceSettingsPanel companyId={company.id} companyName={companyDisplay} /></div>"+
" : <Panel title=\"Company finance settings\"><EmptyState compact title=\"Owner or administrator permission required\" /></Panel>");
one("          ) : section === 'profile' ? (\n            <Panel title=\"My Profile\"",
"          ) : section === 'profile' ? (\n            <Panel title=\"My Profile\"");
one('              <div className="role-settings-form">\n                <label>Full name',
'              <div className="role-settings-actions"><ActionButton tone="secondary" onClick={() => setSection(\'overview\')}>Back to profile overview</ActionButton></div>\n              <div className="role-settings-form">\n                <label>Full name');
fs.writeFileSync(p,s,'utf8');
fs.writeFileSync('app/driver/settings/layout.tsx',
"import type { ReactNode } from 'react';\n// Owner Driver settings already has its own stable sidebar. No duplicate route tabs.\nexport default function DriverSettingsLayout({ children }: { children: ReactNode }) { return children; }\n",'utf8');
console.log('Owner Driver six-category Settings menu implemented.');
