# XDrive Owner Driver — official POD/Invoice alignment (13 November 2026)
Repository: LoadifyMarketLTD/xdrivelogistics.co.uk
Local worktree: C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Redesign-20261113
Branch design/owner-driver-xdrive-cards-20261113; Draft PR #807
Original preview commits b6185db, 82e4a1f (7-tab transport dossier). Main and production untouched.

User review images:
- Action Centre screenshot: four-column stacked pending action rows, duplicate Pending badges, blank toolbar and extra page header; needs future XDrive compact action-card polish.
- Directory screenshot: shared five-column member result grid with many 'Not supplied' / 'Not enough evidence' fields; preserve functional directory and reliable scores. Shared protected component not changed.
- Two screenshots: loading /driver/finance/invoices/<invoice UUID>/<issuer UUID>/<invoice UUID>/INV-202611-004-POD.pdf displays Netlify 404. Root cause: legacy driver finance invoice detail linked <a href={document.file_url}> and file_url is a private relative storage key, not a browser URL.
- Explicit requirement: POD/Invoice PDF must use CURRENT approved model in XDrive main, not old historical generators in pre-master preview branch.

Implemented in this iteration:
1. Synced seven exact source files from GitHub main e013e5f (comparison equal after normalizing Windows line endings):
  - lib/server/professionalPodPdf.ts (approved A4 POD with official logo, delivery details, received by, signature, photo evidence)
  - lib/server/officialXDrivePdfLogo.ts
  - lib/server/podEvidenceClassification.ts
  - lib/server/invoicePdf.ts
  - lib/server/invoicePdfContext.ts
  - app/api/workspace/jobs/[jobId]/pod/pdf/route.ts
  - app/api/driver/finance/invoices/[id]/preview/route.ts
2. app/driver/finance/invoices/[id]/page.tsx: direct href={document.file_url} removed. Opens via authenticated /api/finance/invoice-document-url?invoiceId=...&documentId=... issuing short-lived signed invoice-docs URL; errors shown and popup closed safely.
3. app/components/workspace/DriverJobExecutionPage.tsx: new 7-tab dossier POD now exposes View official POD PDF and Download official POD PDF through existing authenticated /api/workspace/jobs/[jobId]/pod/pdf; Invoice tab has Preview official Invoice PDF through /api/driver/finance/invoices/[id]/preview, and separate Invoice details & payment. Overview POD button opens existing POD details. No record or status mutated.
4. Scripts test-official-pdf-alignment.cjs, fix-current-invoice-document-links.cjs, align-dossier-official-pdfs.cjs.

Verification:
- node scripts/test-official-pdf-alignment.cjs: 13/13 PASS.
- node scripts/test-owner-dossier-v4.cjs: 13/13 PASS.
- npm run typecheck: PASS (full, after copy of required podEvidenceClassification.ts).
- git diff --check PASS.
- Actual authenticated PDF display, signed link response, Netlify build: NOT VERIFIED yet.
- Historical already generated document bytes are immutable; new generation/preview uses current approved generator.

Safety: no main or Netlify production changes, no Supabase writes, no PWA mutation, no old templates manually recreated, old #805/#806 preserved.

Next: commit/push isolated branch PR #807, verify Netlify latest SHA; authenticate in Edge to verify rendering and signed-link 404 fix, run real PDF visual compare. Do not merge without user approval.

## Legal & Agreements video 2026-11-13 22:24
Video 138.3s 1914x994, reviewed 18 contact frames plus full frames at 00:00,00:37,01:15,02:09. Shows /driver/account/legal-agreements, current legal package v2026-09-29-r3, historical acceptances 4 Oct, 1 Oct, 16 Sep, signed readable reproduction (6 pages). Legal records display mojibake (Â·, â€¦). Readable reconstruction explicitly states not original signed PDF. It includes acceptance ID, timestamp, original PDF SHA-256 and evidence SHA-256. Existing signed-document endpoint supports both readable=1 (reconstruction after original hash validation) and default (short-lived signed URL to immutable original).
Patch: app/components/workspace/LegalAgreementsPage.tsx fixes mojibake, explicitly presents View original signed PDF (secured existing signed-document route) alongside Download readable reconstruction (unchanged existing generator). No alteration to original signed evidence, historic agreements, acceptance records, Terms or Privacy text. Script scripts/fix-legal-history-pdfs-v5.cjs.
Verification: JSX transpile PASS; TypeScript npm run typecheck PASS; protected invariant gate PASS; git diff --check PASS. Authenticated click-through for original signed PDF and visual PDF examination NOT YET verified.
User approval not yet obtained for production. Maintain Draft PR #807 only.

## Whole-video audit 2026-11-13 22:38:44 (354.6 seconds; 1912 x 972)
Observed in deployed Preview #807: Settings/My Profile, Company Settings, Company Operations booking factors/delivery notes/specialist services/extra preferences, blocked members, member info, My Vehicle, Drivers & Vehicles (Users & Drivers / Company Vehicles / Vehicle Tracking), Documents (3/3 approved), Membership Billing, Notifications (unread and load alerts), Security, Event Log (659 rows and map replay), Help & Support, Legal & Agreements and PDFs.
Confirmed issues: billing portal displays 'Billing portal could not be opened'; screenshot does not reveal HTTP status, API may report missing Stripe customer, configuration or privilege issues, do not guess root. Legal original/readable copy PDF shows unreadable box glyphs. Font root cause confirmed via @pdf-lib/fontkit: old inter-latin-ext TTF lacks 10 of 11 glyphs in 'Hello World'. Existing primary language source content may also have mojibake in translations; review separately without rewriting signed legal terms.
Fix in progress: introduced Inter Latin plus Latin Extended TTF font family, per-codepoint selection in PDF writer, preserving immutable historical signed originals and acceptance hashes. Future PDFs and readable reconstruction use corrected font. Synthetic controlled-document PDFs generated successfully for en, ro, fr, es, pl, each 5 pages; no missing glyphs for representative English/Romanian and western European strings. Next.js production build started, awaiting result.
Other observations, no modifications made: owner profile/company settings contain long forms and much white space; membership plan trialing until 03 Dec 2026, plan price GBP 29.99 + VAT and blocked Stripe billing portal; notifications list unread load alerts; Event Log shows operational tracking and invoice payment entries; Membership confirmation PDF is legible; legal history uses original vs readable reconstruction distinction. Many modules not yet matched to new XDrive card visual contract; no evidence of successful Save / Stripe / file upload / signed PDF fetch on this video. Protected Post Load / PWA unchanged.

## Workspace readiness timeout — 2026-11-13 23:04
User asked to remediate Settings > Overview `Account requirements and restrictions: The requirements check timed out.` Seen in video 20261113-2253-58. Prior root: WorkspaceRestrictionBanner.tsx aborts advisory request after 20000 ms, duplicates requests on focus and visibilitychange; backend readiness route awaits commercial checks, then driver eligibility serially.
Scope: preview-only isolated branch design/owner-driver-xdrive-cards-20261113, Draft PR #807. Main/production/PWA/Supabase records not edited.
Changes:
1) app/components/workspace/WorkspaceRestrictionBanner.tsx: one active request per account context on focus/visibilitychange, do not restart in-flight, 60-second event throttling after settled result, manual button and WORKSPACE_READINESS_CHANGED bypass throttle, 45-second bounded timeout, stale errors preserve last known blockers; explicit 401 retry remains.
2) app/api/workspace/readiness/route.ts: driver eligibility runs concurrently with legal/Stripe/buyer risk checks; immutable transaction gates and all advisory blockers unchanged. Emits phase durations via Server-Timing header and anonymized warning after 8 seconds; no user IDs.
3) scripts/fix-workspace-readiness-timeout-v7.cjs, parallelize-workspace-readiness-v7.cjs, instrument-workspace-readiness-v7.cjs, test-readiness-timeout-v7.cjs.
Verification completed: full `npm run typecheck` PASS (19.59 seconds); focused 15/15 readiness static checks PASS; `scripts/verify-protected-workspace-invariants.ps1` PASS; git diff --check PASS. `npm run build` started, waiting; authenticated browser latency/E2E not yet demonstrated.
Next: finish Next build, commit/push only to Draft PR #807, verify matching Netlify deploy SHA, report limitations. Never merge main without approval.
