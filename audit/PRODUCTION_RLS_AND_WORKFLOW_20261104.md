# XDrive production database - read-only security and workflow evidence

Date: 2026-11-04. Project: jqxlauexhkonixtjvljw. No mutations, no inserted test data, no secrets exported.

## Data consistency sample
- 40 real jobs; 26 real bids (16 accepted/awarded).
- 14 booking offers: 9 accepted, 5 declined, 0 pending.
- 16 delivered/completed jobs; none of these lacked recorded delivery evidence/POD in the sampled query.
- 0 active in-transit or allocated jobs were found with driver ID but missing vehicle ID.
- 16 invoices; **4 invoices have no job_id**. This is a known workflow reconciliation gap and must be investigated before declaring commercial E2E complete.
- 0 invoices currently flagged paid (payment status sample). Does not prove payments absent outside system.

## RLS isolation (read-only impersonated session checks)
- Public anonymous role: could not read membership or driver rows (both 0), and vehicles access denied to anon.
- Authenticated actor sample 0: foreign drivers 0; foreign vehicles 0; foreign unrelated invoices 0.
- Authenticated actor sample 1: foreign drivers 0; foreign vehicles 0; foreign unrelated invoices 0.
- Authenticated additional sample accounts 2,3,4,5: same three unauthorized-access indicators 0 each.
- For sample 0, 17 jobs belonging to other companies were visible, all 17 had awarded or assigned carrier/company relationship to the selected actor. 0 unrelated foreign jobs, 0 sensitive unassigned foreign jobs.
- The sampled role belonged to an owner account; a separate user with non-owner status and other role types must still be tested before generalizing to every workspace.
- RLS enabled on jobs, bids, membership, invoice, driver and vehicle tables. Booking-offer RLS policy review still required; server API authorization may act as boundary.

## Limitations and release-blocking tests
- Read-only results cannot substitute for actual authenticated REST API RLS test using restricted customer, broker, dispatcher and company driver tokens.
- No mutation test of unauthorized award, accepting another company's offer, POD upload, invoice generation or payments.
- Verify job -> bid -> award -> offer -> accept/decline -> allocate -> tracking -> POD -> invoice -> payment for representative controlled identities before production merge.
- No production records altered, deleted or created.
