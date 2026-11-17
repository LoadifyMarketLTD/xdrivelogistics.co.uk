# XDrive POD strict — OPPO physical E2E evidence (2026-11-17)

## Provenance
- Physical device: OPPO CPH2125 (Android 12), USB ADB device recognized, Chrome DevTools Protocol attached to the Android Chrome browser (not a PC simulator).
- Isolated frontend: `D:\XDrive-POD-Strict-20261117\driver-pwa-reserve`, Vite on Windows `127.0.0.1:5517`, Android USB reverse `tcp:5517 -> tcp:5517`. Live production XDrive API read access via development proxy. Git feature branch `fix/pod-strict-signature-photo-20261117`.
- Existing real authorised Owner Driver login from local private QA configuration. No credentials/tokens in this report.
- Physical test job selected from 25 delivered history rows: a delivered job with unsigned POD, clearly labeled E2E simulation. No existing official POD was overwritten.

## Phone checks
| Check | Evidence | Result |
|---|---|---|
| Device connected | OPPO via ADB, Chrome remote target visible | PASS |
| Real authentication | Signed in on OPPO and live Loads/Quotes/Bookings loaded | PASS |
| History | 25 delivered jobs; 18 showed signed-POD action, 7 lacked it | PASS (observed) |
| Incomplete POD recovery | Delivered unsigned job opens `Complete Signed POD` containing recipient, canvas, date/time, items, camera, files | PASS after fix |
| Submit blocked initially | `Save Signed POD` disabled with missing signature/evidence | PASS |
| Real Android camera | After Chrome site permission, MediaStream video state=4, 480x640, live video track | PASS |
| Physical photo | `Capture Photo` created one in-memory JPEG in Chrome; button still disabled | PASS |
| Native Android file picker | `Add Files` -> Android picker -> selected saved image; two image files in UI | PASS |
| Drawn signature | Android Chrome canvas accepted pointer strokes, `Save Signature` became enabled; no signed record saved | PASS |
| Signature server validation gate | `Save Signed POD` remained disabled while signature only drawn, not server-verified | PASS |
| Limit of 10 images | Using Chrome Android file input, 10 images accepted, attempted 11th rejected, prior 10 preserved | PASS (browser file inputs; native picker also independently tested with one image) |
| Additional paper POD | Required checkbox and server-enforced acknowledgment present in recovery flow | CODE/UNIT PASS; no job requiring hard-copy individually verified on device |
| Positive official POD POST / PDF / invoice | Deliberately not submitted to Production (existing test record, potential invoice/email side effects) | NOT TESTED |
| Server API patch deployed | Patch only lives on isolated Git branch, not Production | NOT DEPLOYED |
| Production DB complete-job trigger | Production trigger patched via versioned migration `20261117095815_enforce_signed_pod_and_delivery_photos.sql`; positive and 5 negative SQL tests passed against a temporary copy | PASS (database) |

## Regression
- Vitest POD/Driver/Finance suite: 76/76 pass before final mobile UX expansion; targeted re-run: 37/37 pass (6 test files) including delivered unsigned recovery contract.
- Reserve PWA Node tests: 168/168 pass after updating outdated legacy assertions, including paper-POD and photo-limit gates.
- Root TypeScript: pass (prior initial code); Reserve PWA TypeScript after additional recovery/hard-copy changes: pass.
- No non-auth business writes performed in physical device tests; no invoice or POD generated.

## Integration rule
Main received concurrent PR #828 and PR #829 commits after PR #827 was branched. Integrate only on a clean latest-main worktree, reconcile `ReserveApp.tsx` and related tests, and repeat full relevant test suites. **Do not claim production POD fail-closed until the database trigger migration has been reviewed, replay-tested and applied.**
