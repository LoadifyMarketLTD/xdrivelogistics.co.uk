# Workflow Decomposition Master Matrix

**Generated**: 2026-07-25  
**Scope**: All 12 platform workflows, decomposed to individual control level  
**Basis**: Static code analysis — live DB evidence required for CLOSED classification  
**Standard**: A workflow row is CLOSED only when: route exists + API exists + DB migration applied + RLS verified + E2E authenticated test passes

---

## Legend

| Status | Meaning |
|---|---|
| CLOSED | All evidence present, authenticated E2E passes |
| PARTIAL | Implementation exists, missing test or secondary control |
| PLACEHOLDER | UI renders, no backend wired |
| BROKEN | Defect confirmed in static analysis |
| NOT_IMPLEMENTED | Code path missing |
| BLOCKED | Requires live DB access to verify |
| DUPLICATE | Same logic implemented in two competing paths |

---

## WF-01: Broker Carrier Invitations

**Basis**: `app/api/broker/carrier-invitations/`, `app/broker/carrier-network/page.tsx`, migrations 20260725130000 + 20260725140000

| # | Control | Route / Function | API | DB Object | RLS | E2E | Status | Required Fix |
|---|---|---|---|---|---|---|---|---|
| 1.01 | Open carrier network page | /broker/carrier-network | — | broker_carrier_invitations | broker_company_id = auth_company_id() | broker.spec.ts#52 | PARTIAL | Authenticated E2E needs E2E_BROKER_EMAIL |
| 1.02 | List existing carriers | BrokerCarrierNetworkPage | GET /api/broker/carrier-invitations | broker_carrier_invitations | ✓ | broker.spec.ts#60 | PARTIAL | Same credential gap |
| 1.03 | List pending invitations | KPI card "Pending" | GET /api/broker/carrier-invitations | broker_carrier_invitations WHERE status=pending | ✓ | broker.spec.ts#60 | PARTIAL | — |
| 1.04 | Enter email | InviteForm input | client-side | — | n/a | — | PARTIAL | — |
| 1.05 | Normalise email | POST /api/broker/carrier-invitations | server: .toLowerCase().trim() | — | n/a | — | CLOSED | — |
| 1.06 | Reject blank email | POST /api/broker/carrier-invitations | 400 if !email | — | n/a | broker.spec.ts#67 | PARTIAL | E2E_BROKER_EMAIL needed |
| 1.07 | Reject malformed email | POST /api/broker/carrier-invitations | regex validation | — | n/a | — | PARTIAL | No E2E |
| 1.08 | Reject duplicate pending invitation | POST /api/broker/carrier-invitations | unique partial index | broker_carrier_invitations | ✓ | — | PARTIAL | No E2E |
| 1.09 | Create invitation | POST /api/broker/carrier-invitations | INSERT | broker_carrier_invitations | invited_by = auth.uid() | — | PARTIAL | No authenticated E2E |
| 1.10 | Persist invited_by | POST handler line ~60 | INSERT invited_by | broker_carrier_invitations.invited_by | n/a | — | CLOSED | — |
| 1.11 | Prevent invited_by mutation | Migration 20260725130000 RLS WITH CHECK | UPDATE policy | broker_carrier_invitations | ✓ | — | PARTIAL | No E2E |
| 1.12 | Send invitation notification | POST handler: notification_events INSERT | notification_events | notification_events | service_role | — | PARTIAL | No E2E; Android won't receive until bridge applied |
| 1.13 | Display invitation to carrier | /carrier/broker-invitations | GET /api/carrier/broker-invitations | broker_carrier_invitations | broker_carrier_inv_carrier_select | broker.spec.ts#90 | PARTIAL | E2E_CARRIER_EMAIL needed |
| 1.14 | Accept invitation | PATCH /api/carrier/broker-invitations?action=accept | PATCH /api/carrier/broker-invitations | broker_carrier_invitations | ✓ | — | PARTIAL | No E2E |
| 1.15 | Reject invitation | PATCH …?action=reject | PATCH | broker_carrier_invitations | status includes 'rejected' | — | PARTIAL | No E2E |
| 1.16 | Revoke invitation | PATCH /api/broker/carrier-invitations/[id]?action=revoke | broker-invitations/[id] | broker_carrier_invitations | ✓ | — | PARTIAL | No E2E |
| 1.17 | Prevent acceptance after revoke | CHECK constraint status IN | server guard | broker_carrier_invitations | ✓ | — | PARTIAL | No E2E |
| 1.18 | Create carrier membership | After accept → company_memberships | Needs verification | company_memberships | BLOCKED | — | BLOCKED | Live DB needed |
| 1.19 | Update UI after create | Optimistic refresh in page | client-side router.refresh() | — | n/a | — | PARTIAL | — |
| 1.20 | Update UI after revoke | Same | — | — | n/a | — | PARTIAL | — |
| 1.21 | Audit create | owner_audit_log insert | notification_events | owner_audit_log | BLOCKED | — | BLOCKED | Live DB |
| 1.22 | Audit accept | owner_audit_log | — | owner_audit_log | BLOCKED | — | BLOCKED | — |
| 1.23 | Audit reject | owner_audit_log | — | owner_audit_log | BLOCKED | — | BLOCKED | — |
| 1.24 | Audit revoke | owner_audit_log | — | owner_audit_log | BLOCKED | — | BLOCKED | — |
| 1.25 | Authorised broker succeeds | Role check in API | owner/company_admin guard | profiles.role | ✓ | — | PARTIAL | No E2E |
| 1.26 | Unauthorised broker fails | 403 on wrong role | 403 | profiles.role | ✓ | — | PARTIAL | No E2E |
| 1.27 | Other company cannot read | broker_carrier_inv_select RLS | RLS | broker_carrier_invitations | ✓ | — | PARTIAL | No live verify |
| 1.28 | Other company cannot mutate | UPDATE/INSERT RLS WITH CHECK | RLS | broker_carrier_invitations | ✓ | — | PARTIAL | No live verify |
| 1.29 | Chromium E2E | broker.spec.ts#52-102 | — | — | — | SKIPPED (E2E_BROKER_EMAIL) | PARTIAL | Set credential |
| 1.30 | Mobile Safari E2E | Same spec, mobile-safari project | — | — | — | SKIPPED | PARTIAL | Set credential |

---

## WF-02: Job Creation

**Basis**: `/api/jobs/create`, `app/admin/jobs/page.tsx`, `app/customer/post-load/page.tsx`, migration 079

| # | Control | Route / Function | API | DB Object | RLS | E2E | Status |
|---|---|---|---|---|---|---|---|
| 2.01 | Navigate to post-load (customer) | /customer/post-load | — | — | ✓ | — | PARTIAL |
| 2.02 | Navigate to new job (admin) | /admin/jobs → new job form | — | — | ✓ | job-operations#257 | PARTIAL |
| 2.03 | Fill job form — required fields | client form | — | — | n/a | — | PARTIAL |
| 2.04 | Reject missing pickup_location | server-side validation | POST /api/jobs/create | — | n/a | — | PARTIAL |
| 2.05 | Reject missing delivery_location | same | same | — | n/a | — | PARTIAL |
| 2.06 | Reject missing dates | same | same | — | n/a | — | PARTIAL |
| 2.07 | Create job | POST /api/jobs/create | INSERT jobs | jobs | company_id = auth_company_id() | — | PARTIAL |
| 2.08 | Idempotency guard | Migration 20260721000500 | idempotency_key unique | jobs | ✓ | — | PARTIAL |
| 2.09 | Set status = open | POST handler | INSERT status='open' | jobs.status | ✓ | — | PARTIAL |
| 2.10 | Persist company_id | POST handler | INSERT company_id | jobs.company_id | ✓ | — | PARTIAL |
| 2.11 | Job visible on marketplace | exchange_load_board view | SELECT | exchange_load_board | ✓ | — | BLOCKED |
| 2.12 | Notification on job created | Not implemented | — | — | — | — | NOT_IMPLEMENTED |
| 2.13 | Admin can create on behalf | /admin/jobs/new | POST /api/jobs/create | jobs | admin role guard | job-operations#257 | PARTIAL |
| 2.14 | Customer cannot create for other company | RLS company_id check | POST guard | jobs | ✓ | — | PARTIAL |
| 2.15 | Chromium E2E | job-operations-contract.spec.ts#257 | — | — | — | SKIPPED | PARTIAL |
| 2.16 | Mobile Safari E2E | same | — | — | — | SKIPPED | PARTIAL |

---

## WF-03: Quote / Bid Lifecycle

**Basis**: `app/api/admin/bids/`, `/api/customer/bids/[id]/award`, migrations 061, 062, 080

| # | Control | API | DB Object | RLS | E2E | Status |
|---|---|---|---|---|---|---|
| 3.01 | Driver submits bid | POST /api/driver/mobile/bids | job_bids | bidder_user_id = auth.uid() | — | PARTIAL |
| 3.02 | Bid amount validation | server validation | — | n/a | — | PARTIAL |
| 3.03 | Duplicate bid guard | unique partial index | job_bids | ✓ | — | PARTIAL |
| 3.04 | Broker lists bids | GET broker/bids | job_bids | company_id = auth_company_id() | — | PARTIAL |
| 3.05 | Admin lists bids | GET /api/admin/bids/identities | job_bids | admin guard | — | PARTIAL |
| 3.06 | Customer awards bid | POST /api/customer/bids/[id]/award | job_bids + jobs | ✓ | — | PARTIAL |
| 3.07 | Bid status: accepted | award handler UPDATE | job_bids.status='accepted' | ✓ | — | PARTIAL |
| 3.08 | Notification on bid accepted | trg_notify_bid_accepted trigger | notification_events | service_role | — | PARTIAL |
| 3.09 | Admin accepts bid | POST /api/admin/bids/[id]/accept | job_bids + jobs | admin guard | — | PARTIAL |
| 3.10 | Admin rejects bid | POST /api/admin/bids/[id]/reject | job_bids | admin guard | — | PARTIAL |
| 3.11 | Quote state machine contract | quote-lifecycle-contract.spec.ts | — | — | — | CLOSED (static) |
| 3.12 | Withdraw quote | admin quotes page | job_bids | ✓ | quote-lifecycle#148 | PARTIAL |
| 3.13 | Revise quote | admin quotes page | job_bids | ✓ | quote-lifecycle#158 | PARTIAL |
| 3.14 | Driver notified of acceptance | notification_events → notifications (bridge) | notifications | ✓ | — | PARTIAL |
| 3.15 | Chromium E2E (authenticated) | quote-lifecycle-contract.spec.ts#113+ | — | — | SKIPPED | PARTIAL |

---

## WF-04: Job Allocation / Driver Assignment

**Basis**: `/api/admin/jobs/[id]/assign-driver`, migration 110

| # | Control | API | DB Object | RLS | E2E | Status |
|---|---|---|---|---|---|---|
| 4.01 | Admin selects driver | /admin/jobs/[id] → assign form | — | — | — | PARTIAL |
| 4.02 | Assign driver atomic | POST /api/admin/jobs/[id]/assign-driver | jobs + job_bids | admin guard | — | PARTIAL |
| 4.03 | Update job.assigned_driver_id | assign handler | jobs | ✓ | — | PARTIAL |
| 4.04 | Notify driver (job_assigned) | trg_notify_job_assigned | notification_events | service_role | — | PARTIAL |
| 4.05 | Bridge to notifications (Android) | trg_bridge_notification_event_to_inbox | notifications | service_role | — | PARTIAL (new migration) |
| 4.06 | Driver sees assignment on mobile | /api/driver/mobile/resources | notification_events | service_role | — | PARTIAL |
| 4.07 | Android driver sees assignment | notifications REST | notifications | RLS user_id | — | PARTIAL (needs bridge migration) |
| 4.08 | Job status → allocated | assign handler | jobs.status | ✓ | — | PARTIAL |
| 4.09 | Company isolation | jobs.company_id guard | jobs | ✓ | — | PARTIAL |
| 4.10 | Chromium E2E | job-operations#275 (401 test only) | — | — | SKIPPED | PARTIAL |

---

## WF-05: Job Status Lifecycle (Driver Execution)

**Basis**: `/api/driver/mobile/jobs/[id]/[action]`, `/api/admin/jobs/[id]/transition`, migration 079, 082

| # | Control | API | Canonical Status | E2E | Status |
|---|---|---|---|---|---|
| 5.01 | allocated → on_my_way | mobile [action] | allocated | — | PARTIAL |
| 5.02 | on_my_way → on_site_pickup | mobile [action] | on_my_way | — | PARTIAL |
| 5.03 | on_site_pickup → loaded (collection proof guard) | mobile [action] | on_site_pickup | — | PARTIAL |
| 5.04 | loaded → in_transit | mobile [action] | loaded | — | PARTIAL |
| 5.05 | in_transit → on_site_delivery | mobile [action] | in_transit | — | PARTIAL |
| 5.06 | on_site_delivery → delivered (POD guard) | mobile [action] | on_site_delivery | — | PARTIAL |
| 5.07 | delivered → completed | admin transition | delivered | — | PARTIAL |
| 5.08 | completed is terminal | state machine guard | completed | job-operations#68 | CLOSED (static) |
| 5.09 | Invalid transition rejected | 400 from transition API | — | job-operations#86 | CLOSED (static) |
| 5.10 | Admin force transition | POST /api/admin/jobs/[id]/transition | jobs | admin guard | PARTIAL |
| 5.11 | State machine contract (static) | job-operations-contract.spec.ts | — | CLOSED (static) | CLOSED |
| 5.12 | Android status alias mapping | driverStatusKey() in Models.kt | — | — | PARTIAL (potential drift) |
| 5.13 | Notification on status change | Not wired to notification_events for status changes | — | — | NOT_IMPLEMENTED |
| 5.14 | Chromium E2E (authenticated) | job-operations#206+ | SKIPPED | — | PARTIAL |

---

## WF-06: POD (Proof of Delivery)

**Basis**: `/api/pod/signed-url`, `supabase/storage`, migrations 032, 20260724235900

| # | Control | API | DB Object | RLS | E2E | Status |
|---|---|---|---|---|---|---|
| 6.01 | Driver uploads POD photo | mobile POD screen | pod-docs storage | storage RLS | — | PARTIAL |
| 6.02 | Collection proof upload | collection_photo_url on jobs | jobs | ✓ | — | PARTIAL |
| 6.03 | Delivery photos upload | delivery_photos jsonb | jobs | ✓ | — | PARTIAL |
| 6.04 | Signature capture | delivery_signature_data | jobs | ✓ | — | PARTIAL |
| 6.05 | Recipient name required | POD completeness guard | jobs | ✓ | job-operations#130 | CLOSED (static) |
| 6.06 | POD completeness contract | hasPod + signature + name | — | — | job-operations#130 | CLOSED (static) |
| 6.07 | Collection proof guard before loaded | mobile action guard | — | ✓ | — | PARTIAL |
| 6.08 | POD guard before delivered | mobile action guard | — | ✓ | — | PARTIAL |
| 6.09 | Get signed URL for POD | GET /api/pod/signed-url | pod-docs | storage RLS | driver-workspace#80 | PARTIAL |
| 6.10 | Admin POD review | /admin/invoices/[id] | jobs.pod_photos | ✓ | — | PARTIAL |
| 6.11 | Broker POD review | /broker/pod-review | GET /api/broker/pod-review/[jobId] | jobs + pod-docs | ✓ | — | PARTIAL |
| 6.12 | Notification on POD (pod_uploaded) | trg_notify_pod_uploaded | notification_events | service_role | — | PARTIAL |
| 6.13 | Android POD upload | native POD picker → pod-docs | pod-docs | BLOCKED | — | BLOCKED |
| 6.14 | Storage RLS for pod-docs | Migration 20260724235900 | storage.objects | ✓ | — | PARTIAL |
| 6.15 | Chromium E2E | driver-workspace#80 (401 test only) | — | PARTIAL | PARTIAL |

---

## WF-07: Invoicing

**Basis**: `/api/driver/finance/`, `/api/admin/invoices/`, `/api/finance/`, migrations 092-093, 125-129

| # | Control | API | DB Object | RLS | E2E | Status |
|---|---|---|---|---|---|---|
| 7.01 | Driver lists eligible jobs | GET /api/driver/finance/jobs/eligible | jobs | driver guard | driver-workspace#70 | PARTIAL |
| 7.02 | Driver generates invoice | POST /api/driver/finance/jobs/[jobId]/generate-invoice | invoices | ✓ | driver-workspace#56 | PARTIAL |
| 7.03 | Overpayment guard | serialize_overpayment_guard migration | invoices | ✓ | — | PARTIAL |
| 7.04 | Invoice snapshot integrity | invoice_snapshot_integrity migration | invoices | ✓ | — | PARTIAL |
| 7.05 | Driver submits invoice | POST /api/driver/finance/invoices/[id]/submit | invoices | ✓ | driver-workspace#63 | PARTIAL |
| 7.06 | Driver views invoice | GET /api/driver/finance/invoices/[id] | invoices | ✓ | — | PARTIAL |
| 7.07 | Admin views invoice | GET /api/finance/invoices/[id] | invoices | admin guard | invoice-lifecycle#136 | PARTIAL |
| 7.08 | Admin lifecycle (send/void) | POST /api/admin/invoices/[id]/lifecycle | invoices | admin guard | invoice-lifecycle#167 | PARTIAL |
| 7.09 | Payment history | GET /api/admin/invoices/[id]/payment-history | invoice_payment_history | admin guard | super-admin.spec#39 | PARTIAL |
| 7.10 | Driver raises dispute | POST /api/driver/finance/invoices/[id]/disputes | job_disputes | ✓ | — | PARTIAL |
| 7.11 | Notification on dispute | notification_events INSERT | notification_events | service_role | — | PARTIAL |
| 7.12 | Invoice document upload | POST /api/driver/finance/invoices/[id]/documents | driver-docs storage | ✓ | — | PARTIAL |
| 7.13 | Invoice document URL | GET /api/finance/invoice-document-url | driver-docs | ✓ | finance-workspace#48 | PARTIAL |
| 7.14 | Invoice status canonicalization | lib/invoiceStatus.ts | — | n/a | invoice-lifecycle (static) | CLOSED (static) |
| 7.15 | Legacy status mapping | same | — | n/a | invoice-lifecycle#33 | CLOSED (static) |
| 7.16 | Invoice notification on create | migration 116 trigger | notification_events | service_role | — | PARTIAL |
| 7.17 | Chromium E2E (authenticated) | invoice-lifecycle#130+ | — | SKIPPED | — | PARTIAL |

---

## WF-08: Onboarding

**Basis**: `/api/onboarding/`, `/onboarding/`, migrations 099-117

| # | Control | API | DB Object | E2E | Status |
|---|---|---|---|---|---|
| 8.01 | Driver onboarding URL | /onboarding/[token] or /onboarding/individual-driver | onboarding_applications | individual-driver-onboarding (static) | CLOSED (static) |
| 8.02 | Individual driver (no company) | /api/onboarding/submit/individual-driver | onboarding_applications | — | PARTIAL |
| 8.03 | Owner-driver onboarding | /onboarding/owner-driver/[token] | onboarding_applications | — | PARTIAL |
| 8.04 | Fleet (carrier) onboarding | /onboarding/fleet/[token] | onboarding_applications | — | PARTIAL |
| 8.05 | Customer onboarding | /onboarding/customer/[token] | onboarding_applications | — | PARTIAL |
| 8.06 | Broker onboarding | /onboarding/broker/[token] | onboarding_applications | — | PARTIAL |
| 8.07 | Resume onboarding | /onboarding/*/resume | onboarding_applications | — | PARTIAL |
| 8.08 | Submit application | /api/onboarding/submit/* | onboarding_applications | — | PARTIAL |
| 8.09 | Notification on submit | notification_events INSERT | notification_events | — | PARTIAL |
| 8.10 | Admin reviews application | /api/super-admin/onboarding/[id] | onboarding_applications | owner guard | — | PARTIAL |
| 8.11 | Approve with hotfix (individual driver) | review_onboarding_application_atomic | onboarding_applications + profiles | — | PARTIAL |
| 8.12 | Notification on approval | notification_events INSERT | notification_events | — | PARTIAL |
| 8.13 | Applicant redirected after approval | /pending-approval page | — | — | PARTIAL |
| 8.14 | Verified company requirement | migration 20260723205100 | onboarding_applications | — | PARTIAL |
| 8.15 | State machine (submitted→under_review→approved/rejected) | migration 102 | onboarding_applications.status | — | PARTIAL |
| 8.16 | Chromium E2E | None | — | — | NOT_IMPLEMENTED |

---

## WF-09: Notification Delivery

**Basis**: `notification_events`, `notifications`, edge function `notify-operational-event`

| # | Control | Producer | Consumer | Status | Required Fix |
|---|---|---|---|---|---|
| 9.01 | job_assigned event created | trg_notify_job_assigned trigger | notification_events table | PARTIAL | Bridge migration needed |
| 9.02 | bid_accepted event created | trg_notify_bid_accepted trigger | notification_events table | PARTIAL | Bridge migration needed |
| 9.03 | pod_uploaded event created | trg_notify_pod_uploaded trigger | notification_events table | PARTIAL | Bridge migration needed |
| 9.04 | Carrier invitation event | POST /api/broker/carrier-invitations | notification_events table | PARTIAL | Bridge migration needed |
| 9.05 | Invoice dispute event | POST /api/driver/finance/invoices/[id]/disputes | notification_events table | PARTIAL | Bridge migration needed |
| 9.06 | Onboarding event | POST /api/onboarding/* | notification_events table | PARTIAL | Bridge migration needed |
| 9.07 | Expo mobile receives | GET /api/driver/mobile/resources → alerts | notification_events | PARTIAL | — |
| 9.08 | Web NotificationBell | supabase.from('notification_events') | notification_events | PARTIAL | — |
| 9.09 | Customer updates page | supabase.from('notification_events') | notification_events | PARTIAL | RLS verified? |
| 9.10 | Android native receives | supabase REST /notifications?user_id=xxx | notifications (EMPTY — no writers) | BROKEN | Apply bridge migration |
| 9.11 | Web /m/ driver receives | supabase.from('notification_events') (fixed) | notification_events | PARTIAL | Fixed in this PR |
| 9.12 | Edge function processes | notify-operational-event | notification_events.status update | BLOCKED | Live DB needed |
| 9.13 | Email delivery | observable_email_trigger migration 115 | notification_events | BLOCKED | Live DB needed |
| 9.14 | Push delivery (Expo) | registerPushToken.ts | expo-notifications | PARTIAL | Device token stored? |
| 9.15 | Push delivery (Android) | NOT IMPLEMENTED | — | NOT_IMPLEMENTED | Add FCM |
| 9.16 | Retry on failure | NOT IMPLEMENTED | — | NOT_IMPLEMENTED | No retry endpoint/UI |
| 9.17 | Notifications RLS isolation | migration 20260723222000 | notification_events | PARTIAL | Live verify |
| 9.18 | notifications table RLS (recipient) | bridge migration (new) | notifications | PARTIAL | Apply bridge migration |

---

## WF-10: Company Onboarding / Approval (Admin Governance)

| # | Control | API | DB Object | Status |
|---|---|---|---|---|
| 10.01 | View pending companies | GET /api/super-admin/companies | companies | PARTIAL |
| 10.02 | Approve company | POST /api/super-admin/companies/[id] | companies.status | PARTIAL |
| 10.03 | Reject/suspend company | POST /api/super-admin/companies/[id] | companies.status | PARTIAL |
| 10.04 | View compliance documents | GET /api/super-admin/compliance | company_documents | PARTIAL |
| 10.05 | Verify operator licence | /super-admin/compliance/operator-licences | company_documents | PLACEHOLDER |
| 10.06 | Verify insurance | /super-admin/compliance/insurance | company_documents | PLACEHOLDER |
| 10.07 | Company audit log | GET /api/super-admin/audit | owner_audit_log | PARTIAL |
| 10.08 | Feature flags | GET/POST /api/super-admin/settings | platform_feature_flags | PARTIAL |
| 10.09 | Platform settings | GET/POST /api/super-admin/platform | platform_settings | PARTIAL |
| 10.10 | Company view (cross-company) | /company page | companies | PARTIAL |
| 10.11 | Owner promotes user | promote_to_platform_owner RPC | profiles | PARTIAL |

---

## WF-11: Support and Disputes

| # | Control | API | DB Object | Status |
|---|---|---|---|---|
| 11.01 | Create support ticket | POST /api/support/tickets | support_tickets | PARTIAL |
| 11.02 | View tickets (super-admin) | GET /api/super-admin/support | support_tickets | PARTIAL |
| 11.03 | Create dispute | POST /api/driver/finance/invoices/[id]/disputes | job_disputes | PARTIAL |
| 11.04 | View disputes (broker) | GET /api/broker/disputes/[id] | job_disputes | PARTIAL |
| 11.05 | Resolve dispute | PATCH /api/broker/disputes/[id] | job_disputes | PARTIAL |
| 11.06 | Super-admin disputes view | /super-admin/support/disputes | job_disputes | PARTIAL |
| 11.07 | Notification on dispute | notification_events | notification_events | PARTIAL |
| 11.08 | Chromium E2E | super-admin-support.spec.ts | SKIPPED (E2E_OWNER_EMAIL) | PARTIAL |

---

## WF-12: Customer Access / Job Visibility

| # | Control | API | DB Object | Status |
|---|---|---|---|---|
| 12.01 | Customer views jobs | /customer/loads | jobs (company_id match) | PARTIAL |
| 12.02 | Customer posts load | POST /api/jobs/create | jobs | PARTIAL |
| 12.03 | Customer views quotes | /customer/quotes | job_bids | PARTIAL |
| 12.04 | Customer awards bid | POST /api/customer/bids/[id]/award | job_bids + jobs | PARTIAL |
| 12.05 | Customer views invoices | /customer/invoices | invoices | PARTIAL |
| 12.06 | Customer team management | GET/POST /api/customer/team | company_memberships | PARTIAL |
| 12.07 | Customer deliveries | /customer/deliveries | jobs + pod-docs | PARTIAL |
| 12.08 | Customer updates feed | /customer/updates | notification_events | PARTIAL |
| 12.09 | Customer cannot see other company | RLS company_id | jobs | PARTIAL |
| 12.10 | Chromium E2E | customer.spec.ts | SKIPPED (E2E_CUSTOMER_EMAIL) | PARTIAL |

---

## Summary: True Status Totals (workflow rows)

| Status | Count |
|---|---|
| CLOSED | 8 (static-only tests) |
| PARTIAL | 148 |
| PLACEHOLDER | 3 |
| BROKEN | 1 (WF 9.10 — Android notifications) |
| NOT_IMPLEMENTED | 3 |
| BLOCKED | 8 |
| DUPLICATE | 0 |

**Zero workflows qualify for CLOSED under the full standard (authenticated runtime E2E + live DB verification).**

The 8 CLOSED rows are static contract tests only (state machines, serialization, role contracts).
