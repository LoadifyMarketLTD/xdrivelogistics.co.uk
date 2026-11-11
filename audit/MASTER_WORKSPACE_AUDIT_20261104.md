# XDrive Master Unification - Source Audit and Release Gates

Date: 2026-11-04 | Feature branch: feat/master-workspaces-unification-20261104

## Scope and distinction

- All 67 Admin page.tsx files were individually enumerated and classified at source level.
- PRE-CHANGE 65/67 Admin routes used the historical TopWorkspaceShell; Dashboard and one Job Details route were Master.
- Branch changes direct all Admin and Broker subroutes to a shared Master outer shell. This alone does not certify internal page/component parity.
- Full behavioral, visual, permissions and API/E2E validation is outstanding. Main/Netlify release is blocked.
- No production database updates, no PWA file modifications, no GitHub Actions.

## Workspace inventory (pages, not verified E2E)

| Route group | Pages | Shell / status |
|---|---:|---|
| /admin | 67 | Master outer shell on feature branch; legacy inner pages remain to migrate |
| /customer | 29 | Master shared shell; authenticated preview bypass under correction |
| /broker | 33 | Master outer shell on feature branch; legacy inner pages remain to migrate |
| /driver | 41 | Master shared shell; authenticated preview bypass under correction |
| /super-admin | 74 | Separate SuperAdmin shell; styling aligned on feature branch, component reuse incomplete |

## Each Admin route â€” code inspection

| Route | Historical outer shell | Source has actions | Direct Supabase | API/fetch | Custom markup | Review |
|---|---|---|---|---|---|---|
| /admin/action-centre | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/bids | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/broker-invitations | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/bulk-import | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/collections | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/companies | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/deliveries | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/diary | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/dispatchers | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/disputes | TopWorkspaceShell | True | True | False | True | Legacy content migration / E2E required |
| /admin/documents/company | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/documents/expiry | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/documents | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/driver-availability | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/drivers | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/drivers-vehicles | TopWorkspaceShell | False | False | False | True | Legacy content migration / E2E required |
| /admin/event-log | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/exchange | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/exchange-quotes | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/balances | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/carrier-invoices/{id} | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/carrier-invoices | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/customer-invoices | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/payments | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/reports | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/finance/statements | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/fleet/active-jobs | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/fleet/assignments | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/fleet/availability | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/fleet/compliance | TopWorkspaceShell | True | False | True | False | Legacy content migration / E2E required |
| /admin/fleet/drivers | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/fleet/future-availability | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/fleet/jobs | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/fleet/maintenance | TopWorkspaceShell | True | False | False | False | Legacy content migration / E2E required |
| /admin/fleet/managers | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/fleet | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/fleet/positions | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/fleet/resources | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/fleet/returns | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/fleet/vehicles | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/freight-vision | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/incidents | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/invoices/{id} | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/invoices/new | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/invoices | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/jobs/{id}/edit | TopWorkspaceShell | True | False | False | False | Legacy content migration / E2E required |
| /admin/jobs/{id} | MasterWorkspace detail exception | True | True | True | True | Master details; authenticated checks pending |
| /admin/jobs | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/live-availability | TopWorkspaceShell | True | False | True | True | Legacy content migration / E2E required |
| /admin/marketplace/directory | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/marketplace | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/messages | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/notifications | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/operations-centre | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin | MasterWorkspace | False | False | False | False | Master; functional review pending |
| /admin/pod | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/post-load | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/quotes | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/returns | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/settings/billing | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/settings/legal-agreements | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/settings | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/support | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |
| /admin/team | TopWorkspaceShell | True | False | False | True | Legacy content migration / E2E required |
| /admin/vehicles | TopWorkspaceShell | True | True | True | True | Legacy content migration / E2E required |
| /admin/won-work | TopWorkspaceShell | False | False | False | False | Legacy content migration / E2E required |

## Release gates

- [ ] 1: 67 Admin pages individually visual + functional compliant (source inventory completed; gate open)
- [ ] 2: Nine roles share identical approved Master components and behavior (outer shell unification partial)
- [ ] 3: Post Load approved and full workflow verified (15-min implementation present, no live E2E)
- [ ] 4: Award fullscreen approved and used in all authorized paths (buyer quote component reused in branch; no live E2E)
- [ ] 5: Commercial workflow Post Load to Quotes to Award to Bookings to Tracking to POD to Invoice to Payment verified (not done)
- [ ] 6: Production Supabase RLS/tenant isolation and role action authorization verified (read-only schema checks only)
- [ ] 7: Full TS/ESLint/tests/Next build and regressions PASS (focused checks started; release suite not done)
- [ ] 8: Full visual comparison and authenticated E2E across roles (not done)

## High-priority nonconformities / next implementation

1. Migrate old Admin page content, including stateful modals, filters, tables and actions, into reusable Master components without deleting functions.
2. Reconcile Super Admin navigation with Master components while preserving privileged controls and 74 page routes.
3. Validate broker/company/customer carrier award request and audit both mandatory acknowledgements in Supabase.
4. Correct navigation deep links, avoid stale URL/selected tab mismatch and duplicate shells.
5. Verify functional cross-company access denial for loads, bids, bookings, invoices, documents and driver records.
6. Run production-equivalent end-to-end test with controlled authorized identities before merging to main.
