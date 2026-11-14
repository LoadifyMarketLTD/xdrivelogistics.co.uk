# Owner Driver selective integration checkpoint — 14 November 2026

## Authorization and absolute constraints
- User approved selective integration of Preview #807 Owner Driver into a clean branch from current `main`.
- Do **NOT** push, merge, or deploy to production until complete authenticated E2E PASS, all seven roles regression tested, protected surfaces unchanged and owner approval.
- **POST LOAD IS FROZEN**: current production `main` files and functionality, APIs, forms, visual design and related components must remain exactly unchanged. **Driver PWA also untouched**.
- Maintain proper Company Driver, Customer, Broker, Fleet and Dispatcher role isolation.

## Environment
- Repository `LoadifyMarketLTD/xdrivelogistics.co.uk`
- New isolated Git worktree: `C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Main-Integration-20261114`
- Branch: `integration/owner-driver-selective-20261114`
- Based on `main` SHA `593c1bb6`; source Preview #807 branch `design/owner-driver-xdrive-cards-20261113` SHA `a4315231`
- Never merge PR #807 entire: prior audit identified 1,074 differing files and 664 deletions, including protected components.
- Source worktree `C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Redesign-20261113` remains unmodified by this integration.
- Node dependencies in new worktree linked via local NTFS junction to source node_modules, no credentials written.

## Completed integration phase 1 (LOCAL ONLY)
1. **Owner Driver Settings navigation**: six stable categories My Profile, Company Settings, Operations, Security, Billing & Membership, Legal & Agreements. Preserve existing Company Driver route-tabs and all non-owner menus/permission checks; shared RoleSettingsWorkspace is conditionally configured by role. Legal & Billing have same Owner Driver sidebar.
2. **Owner Driver Event Log**: condensed evidence cards; event name/date/reference/actor/source visible; technical IDs expandable; existing CSV and print/export/Replay kept. Other roles receive original Event Log renderer through `driverCompact=false`. CSS scoped to Owner Driver.
3. No changes to Post Load, PWA, API, Supabase, invoicing/payment lifecycle, or other role route pages.
4. Updated exactly two stale layout string checks in local test files; no behavior weakening (sidebar assertion now accepts role-scoped attribute).

## Validation
- `npm run typecheck` PASS after Settings integration, and again after Event Log integration (final run exit 0).
- `node scripts/test-owner-selective-integration.cjs`: 12/12 PASS for main baseline, Post Load/PWA guards, role isolation and Settings controls.
- Eight Settings/billing/permissions/Driver role regression files: **28/28 tests PASS**.
- Shared Event Log parity contract: **5/5 PASS**, with original Admin/Broker/Customer surface verified by contract.
- A separate historical `driverWorkspaceAuditSemantics20261109.test.ts` includes a string assertion for `From (town / postcode)` in Loads. This string is **absent in clean main** and Loads is **unmodified**; 1 pre-existing assertion FAIL is **not attributed to selective integration**. Do not call full suite PASS.
- TypeScript JSX transpilation + CSS PostCSS parse PASS. `git diff --check` PASS.
- No authenticated browser E2E executed against this *new local integration branch*; prior Preview #807 read-only route tests cannot validate new merged code.
- The previously identified authenticated legal PDF defect in Preview #807 remains a source-branch issue; current `main` already carries official logo+Unicode generator (commit 593c1bb). Do not overwrite from old preview.
- Full Next production build, complete unit suite, and cross-role E2E are **NOT TESTED** for the new integration branch.

## Remaining high-priority tasks
- Port other Owner Driver UX/features selectively (Action Centre, Messages, My Jobs dossier, Loads, Quotes, Diary, Finance) with dependency audit and no changes to approved Post Load / Driver PWA. Avoid overwriting current main API, data, security, invoices and shared role components.
- Verify each migrated route fully, including actions/subactions, mobile, documents, MAP, notifications, E2E quote->award->booking->pickup->delivery->POD->invoice->email using disposable test data.
- Run full unit/integration, production build and all 7 roles regression; review visual changes with user.
- Keep release gate NO-GO until 100% approved. NO PUSH/MAIN/MERGE.

## Phase 2 (LOCAL ONLY): Action Centre and Messages
- Preserved ALL existing message send, load, participant validation, Action Centre API and links; UI changes only for Owner Driver via `resolveWorkspaceRole(user) === 'owner_driver'`. Other Company Driver / Driver roles retain original DriverIntegratedNav, page headers, message tabs and duplicate status metadata (by design to avoid changing another role).
- `app/driver/action-centre/page.tsx`: remove redundant header/Action-Messages tab for Owner Driver, avoid duplicating status badges and internal Action number, apply scoped card geometry. Existing 3 filters, refresh, Open details remain active.
- `app/driver/messages/page.tsx`: remove duplicate header/subnavigation/single Conversations tab for Owner Driver, simplify explanatory copy and badge; original thread selection, reply, and refresh remain unchanged. Company Driver unchanged.
- `app/driver/xdrive-owner-actions-messages.css`: only selectors under `.xd-owner-action` and `.xd-owner-messages` on `.xdrive-driver-workspace`, no global Post Load effect. Imported only by Action Centre and Messages pages.
- `scripts/test-owner-action-messages-safety.cjs`: 11/11 PASS including Post Load protected check, Owner/Company role separation, send/reply, no arbitrary recipients.
- Four Vitest files: 38/38 PASS (actionCentreRoleSafety, cxWorkspaceMessengerParity, cxWorkspaceNotificationInbox, driverWorkspaceNavigationPerformance).
- TypeScript re-run after phase 2 PASS (14.94 seconds), CSS PostCSS + JSX transpilation PASS; `git diff --check` PASS.
- Existing first local commit `bedb0b8f` for Settings + Event Log, no remote push. Phase 2 remains local until tests and local commit. This is STILL NOT ready for `main`: Loads/Quotes/Diary/My Jobs/Finance and production E2E write flows have not been selectively integrated or tested.
- All changes remain in isolated worktree on branch integration/owner-driver-selective-20261114 based on `main` 593c1bb; **POST LOAD and PWA totally untouched**. Do not merge PR #807 wholesale.
