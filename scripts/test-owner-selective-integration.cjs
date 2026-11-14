const fs=require('node:fs');
const cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const sh=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const tracked=sh('diff','--name-only','origin/main').split(/\r?\n/).filter(Boolean);
const checks=[
  ['clean latest main baseline',sh('merge-base','origin/main','HEAD')===sh('rev-parse','origin/main')],
  ['Post Load code unmodified',!tracked.some(p=>/post-load|PostLoad|load-posting/i.test(p))],
  ['Driver PWA unmodified',!tracked.some(p=>/pwa|driver-mobile/i.test(p))],
  ['No other role route changed',!tracked.some(p=>/^app\/(customer|broker|admin|company)\//.test(p))],
  ['Seven-role UI integration limited to authorized presentation, tests and documentation',tracked.every(p=>/^(AUTONOMOUS_EXECUTION_CHECKPOINT\.md|docs\/audits\/|app\/(components\/workspace\/|driver\/|try-xdrive-demo\/)|scripts\/|__tests__\/)/.test(p))],
  ['Owner settings has stable six categories',((x)=>x.length===6&&x.every(k=>['My Profile','Company Settings','Operations','Security','Billing & Membership','Legal & Agreements'].includes(k)))([...read('app/components/workspace/RoleSettingsWorkspace.tsx').matchAll(/\{ label: '([^']+)', action:[^\n]+active:[^\n]+ \}/g)].slice(0,6).map(x=>x[1]))],
  ['Owner-specific sidebar controlled by role',read('app/components/workspace/RoleSettingsWorkspace.tsx').includes("role === 'owner' ? ownerNav : nav")],
  ['Non-owner operations permission gate preserved',read('app/components/workspace/RoleSettingsWorkspace.tsx').includes("(role === 'owner' || companyOperationsVisible)")],
  ['Non-owner finance permission gate preserved',read('app/components/workspace/RoleSettingsWorkspace.tsx').includes("(role === 'owner' || canManageBilling)")],
  ['Company Driver route tabs preserved',read('app/driver/settings/layout.tsx').includes("if (isOwnerDriver) return <>{children}</>")&&read('app/driver/settings/layout.tsx').includes('WorkspaceRouteTabs')],
  ['Legal and billing permissions preserve other roles',read('app/driver/_components/OwnerDriverSettingsSectionShell.tsx').includes("resolveWorkspaceRole(user) !== 'owner_driver'")],
  ['No UI impersonation, auth or billing writes added',!tracked.some(p=>p!=='app/driver/finance/page.tsx'&&p!=='app/components/workspace/InvoiceProFinance.module.css'&&/AuthContext|supabase|payment|invoice|api\/|billing\/route/i.test(p))],
];
checks.forEach(([n,v])=>console.log((v?'PASS':'FAIL')+' '+n));
if(checks.some(([n,v])=>!v))process.exitCode=1;
