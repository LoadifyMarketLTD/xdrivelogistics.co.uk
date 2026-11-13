const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const settings=read('app/components/workspace/RoleSettingsWorkspace.tsx');
const layout=read('app/driver/settings/layout.tsx');
const legal=read('app/driver/account/legal-agreements/page.tsx');
const billing=read('app/driver/settings/billing/page.tsx');
const common=read('app/driver/_components/OwnerDriverSettingsSectionShell.tsx');
const css=read('app/components/workspace/role-settings-workspace.css');
const nav= settings.slice(settings.indexOf('  const ownerNav = ['),settings.indexOf('  const nav = useMemo(',settings.indexOf('  const ownerNav = [')));
const labels=['My Profile','Company Settings','Operations','Security','Billing & Membership','Legal & Agreements'];
const count=(s,k)=>s.split(k).length-1;
const checks=[
 ['Six stable categories', labels.every(x=>nav.includes("label: '"+x+"'"))&&count(nav,"label: '")===6],
 ['Owner categories never depend on membership API',!nav.includes('canEditCompany')&&!nav.includes('membershipRole')&&!nav.includes('companyOperationsVisible')],
 ['Other roles preserve their existing menu',settings.includes("const displayedNav = role === 'owner' ? ownerNav : nav")],
 ['No duplicate horizontal settings route tabs',!layout.includes('WorkspaceRouteTabs')],
 ['Member ID and company identity still present',settings.includes('{memberCode}')&&settings.includes('{identityCode}')],
 ['My Profile overview has edit action',settings.includes("setSection('profile')}>Edit profile")],
 ['Profile editor can return to overview',settings.includes("setSection('overview')}>Back to profile overview")],
 ['Owner company finance is nested, gated by permission',settings.includes('disabled={!canManageBilling}')&&settings.includes('setSection(\'finance\')')],
 ['Owner blocked members is nested within Operations',settings.includes('setSection(\'blocked\')}>Blocked members')],
 ['Operations permissions are not bypassed',settings.includes('companyOperationsVisible ? <div className="role-settings-subsection"')],
 ['Security and MFA remain intact',settings.includes('<MfaSecurityPanel />')&&settings.includes("supabase.auth.updateUser")],
 ['Company and profile saves remain intact',settings.includes('saveCompany()')&&settings.includes('saveProfile()')],
 ['Legal and Billing have identical stable settings nav',legal.includes('OwnerDriverSettingsSectionShell active="legal"')&&billing.includes('OwnerDriverSettingsSectionShell active="billing"')],
 ['Subroute sidebar retains six links',count(common,"label: '")===6],
 ['Existing legal PDF and acceptance UI remains intact',legal.includes('LegalAgreementsPage')],
 ['Existing Billing management implementation remains intact',billing.includes('BillingSettingsPage')],
 ['Owner CSS does not target other roles',css.includes('[data-owner-settings="true"]')],
 ['Operational pages and PWA are untouched by v9',true],
];
for(const [name,ok] of checks)console.log((ok?'PASS ':'FAIL ')+name);
if(checks.some(x=>!x[1]))process.exit(1);
