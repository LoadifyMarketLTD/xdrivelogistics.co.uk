# XDrive Business Development CRM — implementation contract (Issue #818)

Status: **IMPLEMENTATION IN DRAFT PR #819 / NOT RELEASED / NOT E2E VALIDATED**. Branch: `feature/business-development-crm-818`. No Production migrations, email sends, or customer data imports. See `docs/checkpoints/XDRIVE_CRM_818_CONTINUATION_2026-11-17.md` for exact current implementation and outstanding gates.

## Verified existing integration points
- `app/super-admin/page.tsx`: current Super Admin Command Centre; preserve approved UI.
- `app/api/onboarding/submit/customer/route.ts`: customer_shipper application.
- `app/api/onboarding/submit/broker/route.ts`: broker_shipper application.
- `app/api/broker/carrier-invitations/route.ts`: broker-owned carrier invitation workflow. **Do not reuse as unsolicited prospect outreach**; it requires active company membership.
- `app/privacy/page.tsx`: privacy notice updated 1 September 2026; review external prospect sourcing and first-contact transparency before launch.

## Data model proposal (new private schema; do not apply yet)
**crm_organisations**: id uuid PK; legal_name; company_number nullable; website nullable; legal_form enum ltd/llp/sole_trader/other/unknown; segment enum customer/broker/forwarder/carrier/mixed; country; source_url; source_checked_at; created_by; created_at; updated_at; status enum discovered/researching/qualified/contacted/replied/onboarding/converted/disqualified; converted_company_id nullable; unique canonical company number when present.

**crm_contacts**: id; organisation_id FK; business_email nullable; business_phone nullable; person_name nullable; job_title nullable; source_url; collected_at; data_classification enum generic_business/personal_business; lawful_basis enum legitimate_interests/consent/other/undetermined; lawful_basis_evidence; first_notice_sent_at nullable; last_verified_at; retention_review_at; status; audit timestamps. Store minimum necessary fields; never store scraped credentials.

**crm_contact_events**: id; organisation_id; contact_id nullable; actor_user_id; channel; direction; event_type; occurred_at; metadata JSONB with allowlisted fields; append-only audit policy.

**crm_suppressions**: id; channel enum email/phone/all; normalized_contact_value; reason enum objection/opt_out/invalid/legal_hold/other; recorded_at; source; unique(channel, normalized_contact_value). Do not expose suppression records to non-privileged users; check before any send/export. Account for 'all' channel overrides.

**crm_campaigns**: id; segment; draft_name; status enum draft/approved/paused/archived; created_by; approval evidence. **No send API in initial release**.

## Security and legal gates
1. Restrict all CRM reads/writes to explicitly authorised Super Admin roles; deny anonymous, carrier, customer, broker and ordinary company-admin roles. RLS fail closed; service-role usage only behind verified server-side authorization.
2. Separate prospect records from live `companies`, `profiles`, marketplace membership and jobs until an independently verified conversion.
3. Normalize and deduplicate organisation numbers, domains and emails; preserve provenance and source date; prevent duplicate outreach.
4. Treat sole traders and unknown entity types as **not eligible for unsolicited email** unless a valid exception/consent is documented. Corporate eligibility alone does not override UK GDPR for named contacts.
5. Conduct and document a legitimate interests assessment where relied upon; issue required privacy information within applicable timeframe; implement objections immediately and persist suppression.
6. Never import restricted Courier Exchange member directories or bypass access controls/terms.
7. No automated email sending, cold-call campaigns, enrichment API, background jobs, or bulk scraping before legal sign-off.
8. Verify PECR, UK GDPR, Companies House source terms, TPS/CTPS for calls, ICO guidance and retention rules with legal reviewer.
9. Record all manual contact events; exports must enforce suppression and access checks.
10. No UI restyling of existing Super Admin; new module follows existing enterprise primitives.

## Build sequence
- Gate A: map existing Super Admin navigation/auth/RLS and legal notice; compare existing data tables. Read-only evidence.
- Gate B: migration + server-side repository and authorization + RLS, test isolated locally. No Production application.
- Gate C: prospect list/create/edit and evidence, status, suppression UI in isolated Super Admin route; tests for RBAC, duplicate prevention, suppression and cross-company access.
- Gate D: legal review, opt-out processing, privacy notice; controlled test without real messages.
- Gate E: manually verified list of 100 UK organisations with provenance, then **separately approved** small-scale compliant outreach; measure real responses and job conversion.

## Non-negotiable acceptance
No false PASS, no synthetic leads represented as real, no production writes, no GitHub Actions used as sole evidence, no payment actions. Stop at gates for review.
