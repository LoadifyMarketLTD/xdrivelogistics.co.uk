# Post Load — checkpoint after user canonical specification, 2026-11-05
Canonical requirement: POST_LOAD_CANONICAL_USER_SPEC_20261105.md, supplied at 23:30 UK. The source is NOT the prior hybrid form.
Repository base: origin/main 1dd78f6d; isolated worktree E:\XDrive-PostLoad-3150-Fix-20261105; branch fix/postload-3150-only-20261105.
Previous WIP commit: 13064b96. Current follow-up edits are not merged/pushed.
Touched: app/components/workspace/LoadPostingForm.tsx, approved-post-load-3150.css, app/api/jobs/create/route.ts, canonical spec doc. Other workspaces, PWA, GitHub main, Netlify and database were NOT changed.
Implemented in isolated code: canonical header navigation, Pickup/Delivery side-by-side, time mode options Between/At/Before/ASAP and 15-minute slots, validated pickup window; Job Description, Body Type, Job Type, Loading Metres, Cubic Metres, Wait & Return/Hiab/Trailer/Moffett; metadata in validated server operationalDetails; booking audience with persisted preference fields; document name/file selection/removal, metadata and 12 MB limit; footer Cancel/Post Load & Save for Repeat Use/Post Load; repeating flag saved into load_details.
ESLint PASS, TypeScript PASS, git diff --check PASS after relevant code edits. QA local route http://127.0.0.1:4188/postload-local-qa HTTP 200 on viewport 1440 and 390, no page JS errors or horizontal document overflow, old Booking target card absent. These are UI/static checks; no real job was posted.
CRITICAL incomplete: private Customer Price separate secure DB storage; genuinely functional customer and location contact-file lookup/Save Contact File and contact fields; en-route email notifications and cadence; radius-driven tracked-driver distribution; actual enforcement SmartPay/EU/electronic-quote options; body type/weight unit conversion parity; repeat-use browsing/repost flow; screenshot parity to user's full reference; authenticated end-to-end posting across Customer/Broker/Carrier/OwnerDriver. Currently the new preference fields are saved as metadata but NOT enforced. Do not merge or deploy, and do not claim complete.
Source local UI at D:\XDrive-PostLoad-QA-20261105 on port 4188. QA route intentionally not tracked for release. No fake fixtures used.

## My Fleet 3150 all-workspace integration (2026-11-06)
Authorized target: My Fleet from localhost:3150 company demo, same canonical DemoFleetBoard visual in production.
Branch: fix/master3150-myfleet-all-roles-20261106; origin/main at start 2af9df6b.
Changed: DemoFleetBoard, MemberFleetOverview, fleet-overview API, driver fleet role check, canonical My Fleet tests.
Pages: /admin/fleet, /broker/fleet, /customer/fleet, /driver/fleet. Admin/owner management routes retained.
Data: API verifies auth plus active company membership, scopes vehicles/drivers to company and documents via allowed membership role and matching vehicle IDs; no example records.
QA: TS/ESLint and isolated 390/1440 browser tests; 4 selected vitest suites pass.
Known prior unrelated test failure: master3150EightLiveWorkspaceContract locks master3150-operations-shell.css to stale baseline; reproduced on untouched previous worktree.
Production-authenticated E2E and Netlify deployment are not confirmed. No GitHub Actions used.
