$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$rows=Import-Csv (Join-Path $root 'audit\admin-routes-20261104.csv')
$roles=Import-Csv (Join-Path $root 'audit\workspace-roles-20261104.csv')
$output=@(
 '# XDrive Master Unification - Source Audit and Release Gates',
 '',
 'Date: 2026-11-04 | Feature branch: feat/master-workspaces-unification-20261104',
 '',
 '## Scope and distinction',
 '',
 '- All 67 Admin page.tsx files were individually enumerated and classified at source level.',
 '- PRE-CHANGE 65/67 Admin routes used the historical TopWorkspaceShell; Dashboard and one Job Details route were Master.',
 '- Branch changes direct all Admin and Broker subroutes to a shared Master outer shell. This alone does not certify internal page/component parity.',
 '- Full behavioral, visual, permissions and API/E2E validation is outstanding. Main/Netlify release is blocked.',
 '- No production database updates, no PWA file modifications, no GitHub Actions.',
 '',
 '## Workspace inventory (pages, not verified E2E)',
 '',
 '| Route group | Pages | Shell / status |',
 '|---|---:|---|'
)
foreach($r in $roles){
 $status=switch($r.role){
  'admin' {'Master outer shell on feature branch; legacy inner pages remain to migrate'}
  'broker' {'Master outer shell on feature branch; legacy inner pages remain to migrate'}
  'customer' {'Master shared shell; authenticated preview bypass under correction'}
  'driver' {'Master shared shell; authenticated preview bypass under correction'}
  'super-admin' {'Separate SuperAdmin shell; styling aligned on feature branch, component reuse incomplete'}
  default {'Not yet individually verified'}
 }
 $output+=("| /"+$r.role+" | "+$r.pages+" | "+$status+" |")
}
$output+=@(
 '',
 '## Each Admin route — code inspection',
 '',
 '| Route | Historical outer shell | Source has actions | Direct Supabase | API/fetch | Custom markup | Review |',
 '|---|---|---|---|---|---|---|'
)
foreach($r in $rows){
 $status=if($r.route -eq '/admin'){'Master; functional review pending'}elseif($r.route -eq '/admin/jobs/{id}'){'Master details; authenticated checks pending'}else{'Legacy content migration / E2E required'}
 $output+=("| "+$r.route+" | "+$r.shell+" | "+$r.actions+" | "+$r.directSupabase+" | "+$r.api+" | "+$r.customUI+" | "+$status+" |")
}
$output+=@(
 '',
 '## Release gates',
 '',
 '- [ ] 1: 67 Admin pages individually visual + functional compliant (source inventory completed; gate open)',
 '- [ ] 2: Nine roles share identical approved Master components and behavior (outer shell unification partial)',
 '- [ ] 3: Post Load approved and full workflow verified (15-min implementation present, no live E2E)',
 '- [ ] 4: Award fullscreen approved and used in all authorized paths (buyer quote component reused in branch; no live E2E)',
 '- [ ] 5: Commercial workflow Post Load to Quotes to Award to Bookings to Tracking to POD to Invoice to Payment verified (not done)',
 '- [ ] 6: Production Supabase RLS/tenant isolation and role action authorization verified (read-only schema checks only)',
 '- [ ] 7: Full TS/ESLint/tests/Next build and regressions PASS (focused checks started; release suite not done)',
 '- [ ] 8: Full visual comparison and authenticated E2E across roles (not done)',
 '',
 '## High-priority nonconformities / next implementation',
 '',
 '1. Migrate old Admin page content, including stateful modals, filters, tables and actions, into reusable Master components without deleting functions.',
 '2. Reconcile Super Admin navigation with Master components while preserving privileged controls and 74 page routes.',
 '3. Validate broker/company/customer carrier award request and audit both mandatory acknowledgements in Supabase.',
 '4. Correct navigation deep links, avoid stale URL/selected tab mismatch and duplicate shells.',
 '5. Verify functional cross-company access denial for loads, bids, bookings, invoices, documents and driver records.',
 '6. Run production-equivalent end-to-end test with controlled authorized identities before merging to main.',
 ''
)
$out=Join-Path $root 'audit\MASTER_WORKSPACE_AUDIT_20261104.md'
$output | Set-Content -Path $out -Encoding UTF8
Write-Output ('AUDIT_REPORT='+$out+' ROUTES='+$rows.Count)
