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
  ['Only approved Owner settings and styles',tracked.every(p=>[
  'AUTONOMOUS_EXECUTION_CHECKPOINT.md',
  'app/components/workspace/RoleSettingsWorkspace.tsx',
  'app/components/workspace/role-settings-workspace.css',
  'app/driver/account/legal-agreements/page.tsx',
  'app/driver/settings/billing/page.tsx',
  'app/driver/settings/layout.tsx',
  'app/components/workspace/WorkspaceEventLogPage.tsx',
  'app/driver/event-log/page.tsx',
  'app/driver/action-centre/page.tsx',
  'app/driver/messages/page.tsx',
  'app/driver/jobs/page.tsx',
  'app/driver/xdrive-owner-actions-messages.css',
  'scripts/port-owner-action-messages.cjs',
  'scripts/test-owner-action-messages-safety.cjs',
  '__tests__/allWorkspaceSettingsParityContract.test.ts',
  '__tests__/cxDriverSettingsRoleBoundaryContract.test.ts',
  'app/driver/_components/OwnerDriverSettingsSectionShell.tsx',
  'app/driver/xdrive-event-log-owner.css',
  'app/driver/xdrive-owner-settings-v9.css',
  'scripts/test-owner-selective-integration.cjs'
  ].includes(p))],
  ['Owner settings has stable six categories',((x)=>x.length===6&&x.every(k=>['My Profile','Company Settings','Operations','Security','Billing & Membership','Legal & Agreements'].includes(k)))([...read('app/components/workspace/RoleSettingsWorkspace.tsx').matchAll(/\{ label: '([^']+)', action:[^\n]+active:[^\n]+ \}/g)].slice(0,6).map(x=>x[1]))],
  ['Owner-specific sidebar controlled by role',read('app/components/workspace/RoleSettingsWorkspace.tsx').includes("role === 'owner' ? ownerNav : nav")],
  ['Non-owner operations permission gate preserved',read('app/components/workspace/RoleSettingsWorkspace.tsx').includes("(role === 'owner' || companyOperationsVisible)")],
  ['Non-owner finance permission gate preserved',read('app/components/workspace/RoleSettingsWorkspace.tsx').includes("(role === 'owner' || canManageBilling)")],
  ['Company Driver route tabs preserved',read('app/driver/settings/layout.tsx').includes("if (isOwnerDriver) return <>{children}</>")&&read('app/driver/settings/layout.tsx').includes('WorkspaceRouteTabs')],
  ['Legal and billing permissions preserve other roles',read('app/driver/_components/OwnerDriverSettingsSectionShell.tsx').includes("resolveWorkspaceRole(user) !== 'owner_driver'")],
  ['No UI impersonation, auth or billing writes added',!tracked.some(p=>/AuthContext|supabase|payment|invoice|api\/|billing\/route/i.test(p))],
];
checks.forEach(([n,v])=>console.log((v?'PASS':'FAIL')+' '+n));
if(checks.some(([n,v])=>!v))process.exitCode=1;
