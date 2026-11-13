# XDrive Logistics Owner Driver design v4 — 13 November 2026
Repository: LoadifyMarketLTD/xdrivelogistics.co.uk
Worktree: C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Redesign-20261113
Branch: design/owner-driver-xdrive-cards-20261113 (Draft PR #807; DO NOT MERGE)
Previous source: b6185db. Historical #805/#806 unchanged. Main, production Netlify, Supabase and PWA unchanged.

User assessment: Loads, Quotes, Diary redesign v3 is positively received; make only small finishing changes there. My Jobs differs most, and detailed job page has a very long, wasteful two-column scroll.

V4 implementation:
- app/driver/jobs/page.tsx: My Jobs now uses same XDriveTransportOverview (journey, schedule, transport data) as Loads/Quotes/Diary. Removed duplicate Driver Workspace/Jobs page header and redundant Diary/My Jobs sub-navigation. Existing filters, execution context, details, Open job/Continue actions and data queries retained.
- app/components/workspace/DriverJobExecutionPage.tsx (desktop branch ONLY): introduced tabbed Transport Dossier with Overview, Order, Tracking, POD, Documents, Invoice, History. Overview displays route, dates, vehicle, POD/invoice summary and contextual actions. Order contains booking terms, pickup/delivery contacts, notes and instructions; Tracking contains Journey Replay; POD contains existing evidence forms, signatures and PDF actions; Documents lists job docs; Invoice displays separate invoice/payment statuses with existing view/create actions; History contains operational timeline. Replaced two-column simultaneous rendering with conditional full-width sections, reducing scrolling and empty space. Mobile/PWA rendering branch verified byte-identical.
- app/driver/xdrive-job-dossier-v4.css imported last from driver layout. Unique XDrive styling, responsive 4/2/1 overview grid, full-width dossier panels, accessible 7-tab buttons, and improved My Jobs card.
- scripts/split-driver-job-dossier.cjs, scripts/refine-my-jobs-v4.cjs, scripts/test-owner-dossier-v4.cjs record edits/tests.

V4 verification:
- 13/13 targeted contract tests PASS, including byte-for-byte unchanged mobile/PWA branch.
- CSS parse PASS.
- TSX transpile PASS.
- Protected XDrive invariants PASS.
- Full npm run typecheck PASS (initial v4 pass; final re-run scheduled).
- Authenticated browser E2E / PDF preview / GPS status transitions NOT YET verified. No live test data mutations.

Next:
1. Re-run full TS check on final files.
2. Commit/push V4 to Draft PR #807.
3. Wait for Netlify Preview SHA deploy Ready, inspect authenticated UI if accessible.
4. Ask for user visual acceptance before any merge; do not modify production.
