# XDrive Driver Reserve - controlled end-to-end job test

Date prepared: 2026-11-08 (Europe/London)
Status: SCHEDULE DEFINED; PRODUCTION WRITES NOT AUTHORISED BY ENV GATE

## Confirmed schedule
- Collection: Monday 2026-11-09 10:00 GMT (2026-11-09T10:00:00Z)
- Delivery: Thursday 2026-11-12 14:00 GMT (2026-11-12T14:00:00Z)
- Use an explicitly labelled **TEST / NO PHYSICAL GOODS / DO NOT DISPATCH** load, posted by authorised XDrive company/customer.
- Suggested distinct reference: XDL-E2E-20261109-1211-TEST (avoid reusing any commercial reference).
- No prefilled real customer's contact details; use authorised internal testing accounts only.
- Use platform API POST /api/jobs/create with an authenticated company member, never direct SQL or modification of existing awarded/quoted route timestamps.

## Backend audit
- Production Supabase project jqxlauexhkonixtjvljw, linked XDRIVE LOGISTICS.
- Existing pending offers include booking job IDs 8c5dd3c6-aa5a-41b8-947d-d818ae198642 and 090cd41c-b6d7-43b5-bfe9-20126bc65004. Both are old QUOTED jobs and must NOT be repurposed into tomorrow's transport. Their original timestamps and commercial snapshots are preserved.
- Admin PATCH /api/admin/jobs/[id] route only permits draft/received/posted job edits with no allocation; returns HTTP 409 for quoted/awarded jobs.
- Desktop C:\Users\xdriv\OneDrive\Desktop\.env.test.txt includes E2E_ALLOW_PRODUCTION_MUTATION=false, E2E_BASE_URL=https://www.xdrivelogistics.co.uk. Do not override flag, bypass auth, or use service role to force writes.
- No production test job was posted, offer awarded, POD uploaded, invoice generated, or email sent in this preparation step.

## Run order once safe authorisation and environment are enabled
1. Verify designated test company and Owner Driver accounts, auth, roles, tenant isolation, Stripe/legal prerequisites. Confirm dates above are still future.
2. Create and publish TEST load (fake goods/no collection); verify status posted and public town/outcode visible on live PWA Pixel.
3. Owner Driver opens Load Details and quotes on real backend using test account and safe amount; verify bid appears only in Quotes.
4. Test edit/withdraw and re-quote on an isolated bid, then authorised company awards the chosen bid.
5. Confirm booking appears under Received, validate complete details before Accept, then Accept.
6. Check Bookings Allocated, timestamped statuses and map actions; test status transitions only with explicit simulated-job authorisation.
7. Collection evidence: upload selected test-only photos; confirm storage and status.
8. Delivery evidence: Received By (test identity), drawn recipient signature, goods, condition, photo; confirm POD A4/combined documents.
9. XDrive Finance: eligibility, draft, issue A4 PDF including *complete signed POD, collection/delivery photos*, send to authorised test mailbox, verify received email and attachment.
10. Compare Pixel live display + backend state + stored data; record PASS/FAIL per step, prevent real dispatch and external commercial emails.

## Guardrails
- The test dates are for a dedicated new test load, not edits to pre-existing customer offers.
- Real production transactions must not be triggered while E2E_ALLOW_PRODUCTION_MUTATION remains false.
- This checkpoint is not proof of E2E completion.
