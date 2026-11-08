# Official XDrive Driver Finance — Complete POD integration
Date: 2026-11-08
Source: https://www.xdrivelogistics.co.uk/driver/finance
Scope: independent reserve branch, including code for the official invoice generator. No main/Netlify modification.

## Original defect
- Official preview route did not require valid signed POD and omitted typed signature attestation when calling PDF builder.
- invoicePdfContext gathered photographs and signature but not the authoritative proof_of_delivery handover record.
- invoicePdf attached photo/signature appendices but no complete delivery handover page.
- invoiceDelivery attached one invoice PDF to the outgoing Resend email, without a separately named Complete POD PDF.

## Corrections, reserve branch
1. Read the latest authoritative proof_of_delivery row for invoice job ID: delivered_on, received_by, left_at, no_of_items, delivery_status, delivery_notes, photo_urls. Require it for job-linked send/preview.
2. Aggregate evidence from delivery photos, POD photos, damage photos, collection photo and proof_of_delivery photo URLs; include recipient signature or verified typed-name attestation.
3. Build an A4 PROOF OF DELIVERY appendix page with complete handover fields and job/invoice references, followed by signature, photographs and original PDF documents.
4. Preview refuses to generate for missing/incomplete POD; passes podSummary, signatureAttestation and images.
5. Email delivery splits combined PDF into two attachments: Invoice.pdf (first page) and Invoice-Complete-POD.pdf (handover, signature, photos, uploaded documents).
6. Fail closed before sending if signed POD pages are missing, or if evidence storage is inaccessible. Keep the sender's existing idempotency/outbox and provider ID logic.
7. Reserve client links to the exact official generator flow: Ready To Invoice, generate-invoice with idempotency key, A4 preview, submit. No manual invoice or fake email confirmation.

## Verification
- Node stripTypeScriptTypes parses all modified backend TS files.
- Six contract tests PASS: tests/invoice-pod-integration.test.mjs.
- Reserve PWA npm run build PASS.
- No real invoice issued, no real A4 PDF with stored evidence rendered for QA, no Resend transaction or email submitted.
- No changes deployed to GitHub main or Netlify. Release gate remains blocked until signed POD, A4 PDF page inspection, and verified email with both attachments.
