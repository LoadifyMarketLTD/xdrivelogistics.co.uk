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
