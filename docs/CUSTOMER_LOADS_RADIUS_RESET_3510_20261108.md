# Customer Loads — Radius 200/300 + instant active-sidebar reset (8 Nov 2026)

Reference: approved Master 3150, Customer Loads. User screenshot from deploy-preview-770 showed Radius ending at 100 miles and sidebar Loads not resetting state.

Changes isolated to Customer Loads and shared sidebar same-route interaction:
- Added 200 and 300 mile options, alongside 5, 10, 20, 30, 50 and 100. Existing real outcode centroid radius filtering computes miles from selected value.
- When user selects already-active main sidebar 'Loads' tab, AuthenticatedMasterShell dispatches 'xdrive:loads-reselect' synchronously rather than performing a redundant router push.
- Customer DemoExchangeBoard (productionMode only) listens and restores initial All Loads, blank From/To/Vehicle/Service/Date, unchecked Same/Next Day, Radius 10 miles, Sort Newest, first page, List View, closed dialogs and no draft quote. Scroll resets immediately. Different sidebar navigation works unchanged. Approved visual structure is untouched.
- No simulated jobs, no API/DB writes, no Driver PWA1099 code changes.

Worktree: D:\XDrive-3510-CustomerLoads-Reset-Radius-20261108
Branch: fix/3510-customer-loads-reset-radius-20261108
Base: origin/main ef9e8238, including prior PR #770 and #772.
Current evidence: scoped ESLint PASS; TypeScript --noEmit --incremental false PASS; Vitest 13/13 PASS. Playwright authenticated interaction test added: e2e/customer3150-radius-reselect-readonly.spec.ts. Full Next.js low-memory build and Netlify preview authenticated E2E remain pending at writing.
Do not merge or claim visual PASS without full checks and authenticated browser verification. Opera connector currently disconnected.
