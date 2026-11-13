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

## Owner Driver V8 operational consistency — 2026-11-13 23:11 screenshots
User screenshots showed Event Log, Messages, Action Centre and Finance with inconsistent old table UI. Visual approval of Loads/Quotes/Diary must be protected. Worktree: C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Redesign-20261113, Draft PR #807, not main.
Implementation:
- app/driver/action-centre/page.tsx: removed duplicate Action/Message tabs and redundant heading; one pending status per card, removed duplicated technical Action # code in footer; retained real rows/filters/navigation/actions.
- app/driver/messages/page.tsx: removed duplicate nav, redundant one-tab Conversations strip and old large header; cleaned technical copy and mojibake; retained participant authorization, thread IDs, send buttons and message data.
- app/components/workspace/WorkspaceEventLogPage.tsx: optional driverCompact prop defaults false, preserving every other role; driver-specific cards show event/date/reference/actor/source and summary, while full technical identifiers remain visible on demand via native details disclosure. CSV, search, print and Journey Replay unchanged. app/driver/event-log/page.tsx enables driverCompact and CSS wrapper.
- app/driver/finance/page.tsx: clarified that GBP amount is payments received (which may include partial settlements) while count is fully paid invoices; source/API amounts not modified. app/components/workspace/InvoiceProFinance.module.css: tightened spacing, visually stacked action labels and descriptions; finance actions unchanged.
- app/driver/xdrive-operations-v8.css imported last from driver layout, scoped Action Centre/Messages/Event Log styles, responsive cards, shared XDrive typography. No PWA/Post Load, authentication, API, billing data, approved Loads/Quotes/Diary changes.
- Scripts: refine-operational-pages-v8.cjs (first phase partially applied, superseded by finish-operational-pages-v8.cjs), finish-operational-pages-v8.cjs, wire-operational-v8.cjs, polish-operational-copy-v8.cjs, refine-eventlog-v8.cjs, test-operational-v8.cjs, eventlog-v8-overrides.txt, finance-v8-overrides.txt, operations-v8-finishing.txt.
Verification: 16/16 focused static contract checks PASS; full npm run typecheck PASS; CSS parse PASS; JSX focused transpile PASS; protected XDrive invariant gate PASS; git diff --check PASS. Authenticated browser E2E not yet tested, finance ledger reconciliation not yet performed (do not claim incorrect payments or adjust values). Netlify deployment status pending after push.

## Owner Driver Settings V9 - 2026-11-13 23:23
Scope: USER APPROVED autonomous correction of Owner Driver Settings screenshot from Netlify PR #807. Branch design/owner-driver-xdrive-cards-20261113, no main/prod/PWA/Supabase mutations.
Observed: Primary role nav 11 items; horizontal Settings + Legal route tabs; internal Settings sidebar 10-14 menu items dynamically depending on membershipRole; More duplicates Documents, Invoices, Messages and Event Log. Owner Settings items Drivers/Staff wrongly linked to /driver/profile, Vehicles already in My Fleet, Finance & Invoices mislabeled for company finance preferences. Settings and More appear concurrently highlighted, More overlays company info. Blank whitespace and old tiny type.
Files edited: app/components/workspace/RoleSettingsWorkspace.tsx: stable six Owner Driver categories My Profile, Company Settings, Operations, Security, Billing & Membership, Legal & Agreements, independent of asynchronous membershipRole. Existing all-role nav remains unchanged. Edit profile action in profile summary. Finance preferences nested under Company Settings, blocked-member admin nested in Operations; still blocked by membership guard. All saveProfile/saveCompany/password/MFA/Supabase calls untouched. Applied owner-scoped CSS in role-settings-workspace.css. app/driver/settings/layout.tsx drops redundant horizontal route-tabs. app/driver/_components/OwnerDriverSettingsSectionShell.tsx + app/driver/xdrive-owner-settings-v9.css wrap Billing and Legal pages with same six-category sidebar; related route pages wrapped without altering original page or models. Scripts: stabilize-owner-settings-v9.cjs, polish-owner-settings-v9.cjs, wire-owner-settings-subroutes-v9.cjs, test-owner-settings-v9.cjs, owner-settings-v9.css.
Verification: focused 18/18 static checks PASS; protected invariant gate PASS; CSS PostCSS parse PASS; JSX transpile PASS; full `npm run typecheck` PASS; git diff --check PASS. Full `npm run build` started PID 13560, status pending. Authenticated UI click-through and membership race E2E NOT YET verified. Main and other roles not changed.
Next: inspect build result; commit and push to PR #807 preview only; confirm exact Netlify SHA Ready, verify UI authenticated if possible; avoid claiming verified UI without evidence.

## Legacy legal PDF font defect — 2026-11-13 23:32
User uploaded readable reconstructions 219B9DA5, 16AD2A73 and original signed agreements 219B9DA5; PDF content is visibly corrupted with XXXXXX/IIII or null/blank glyphs. Embedded original JSON for 219B9DA5 contains complete readable Romanian terms. Root confirmed independently by embedding inspection: Inter-Latin-Ext TTF in historical originals lacks lowercase ASCII a, while old generator embedded ONLY Latin-ext; original SHA256 immutable and cannot be rewritten without invalidating recorded evidence. Historical copies generated at 22:23/22:26/22:44 precede font fix commit 8ce8214 dated 22:58; current branch signedAgreementPdf.ts already embeds both Latin and Latin-ext glyph subsets with selection per codepoint. Existing test-legal-pdf-font-v6.cjs generates five languages and passes en/ro/fr/es/pl but checks page count/font glyph coverage, not fully extracted content.
Recovered exact source for acceptance 219b9da5 from embedded UTF8 JSON attached to original, locally generated corrected six-page readable reconstruction /mnt/data/XDrive-Legal-Readable-Corrected-219B9DA5.pdf (sandbox only) with Unicode DejaVu. Verified 77/77 source section headings and complete section bodies appear intact in extracted output; screenshot page 2 renders correctly with Romanian glyphs. It is labelled RECONSTRUCTION, NOT ORIGINAL SIGNED PDF. The original signed PDF remains immutable.
Updated app/components/workspace/LegalAgreementsPage.tsx: prefer freshly generated readable copy primary download, original archive secondary link; explain that old signed PDFs can have broken text rendering, preserve both options. Scripts repair-legal-pdf-actions-v10.cjs and test-legal-history-readable-v10.cjs (11/11 checks PASS). TS typecheck PASS; generator smoke for five languages PASS. Authentication E2E and preview deployment awaiting verification. Acceptance 16AD2A73 source signed JSON not uploaded, cannot reconstruct faithful historical content from corrupted readable copy alone.
DO NOT overwrite stored signed PDF, alter Supabase acceptance/hash, re-sign, or change legal terms. Keep users informed distinction original vs reconstructed.
