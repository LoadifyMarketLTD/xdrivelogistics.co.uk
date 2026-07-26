# API Inventory Matrix

## Admin

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/admin/bids/[id]/accept | POST | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, job_bids | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/bids/[id]/reject | POST | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, job_bids, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/bids/identities | GET | Yes | owner, admin, dispatcher | Yes | Manual guards | auth.users, companies, company_memberships, drivers, job_bids, profiles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/dispatchers | POST, PATCH | Yes | owner, admin, dispatcher, company_staff | Yes | Zod | auth.users, company_memberships, profiles | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/drivers | POST, PATCH | Yes | owner, admin, dispatcher, driver | Yes | Zod | auth.users, companies, company_memberships, drivers, profiles | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/invoices/[id]/lifecycle | POST | Yes | owner, admin, dispatcher | Yes | Zod | auth.users, company_memberships, invoice_disputes, invoices | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/invoices/[id]/payment-history | POST | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, invoice_payment_history, invoices | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/jobs/[id]/assign-driver | POST | Yes | None detected | Yes | Zod | assign_job_driver_atomic, auth.users | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/jobs/[id]/transition | POST | Yes | owner, admin, dispatcher | Yes | Zod | auth.users, company_memberships, job_tracking_events, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/admin/operations-centre | GET | Yes | owner, driver | Yes | Manual guards | auth.users, company_memberships, driver_documents, driver_locations, drivers, invoices, job_bids, job_tracking_events, jobs, notification_events, profiles, vehicle_documents, vehicles | No | Yes | job-operations-contract.spec.ts | CLOSED | None. |

## Broker

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/broker/carrier-invitations/[id] | PATCH | Yes | owner, admin | Yes | Zod | auth.users, broker_carrier_invitations, company_memberships, notification_events | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/broker/carrier-invitations | GET, POST, DELETE | Yes | owner, admin, company_admin | Yes | Zod | auth.users, broker_carrier_invitations, companies, company_memberships, notification_events | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/broker/disputes/[id] | PATCH | Yes | owner, admin, company_admin | Yes | Zod | auth.users, company_memberships, job_disputes, job_notes, jobs | Yes | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/broker/pod-review/[jobId] | PATCH | Yes | None detected | Yes | Zod | auth.users, company_memberships, job_notes, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |

## Carrier

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/carrier/broker-invitations | GET | Yes | None detected | Yes | Manual guards | auth.users, broker_carrier_invitations, companies, company_memberships | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |

## Customer

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/customer/bids/[id]/award | POST | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, job_bids, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/customer/team | GET, POST, PATCH | Yes | owner, admin, dispatcher | Yes | Zod | auth.users, company_memberships, profiles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |

## Driver

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/driver/finance/invoices/[id]/disputes | GET, POST | Yes | None detected | Yes | Manual guards | auth.users, drivers, invoice_disputes, invoices, notification_events | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/finance/invoices/[id]/documents | GET, POST | Yes | None detected | Yes | Manual guards | auth.users, drivers, invoice_documents, invoices | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/finance/invoices/[id]/payment-history | GET, POST | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, drivers, invoice_payment_history, invoices | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/finance/invoices/[id] | GET | Yes | None detected | Yes | Manual guards | auth.users, drivers, invoice_disputes, invoice_documents, invoice_payment_history, invoice_status_history, invoices | No | No | driver-workspace-contract.spec.ts | CLOSED | None. |
| /api/driver/finance/invoices/[id]/submit | POST | Yes | owner, admin, dispatcher | Yes | Manual guards | auth.users, companies, company_memberships, invoice-docs, invoice_documents, invoices | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/finance/invoices | GET, POST | Yes | owner, admin | Yes | Manual guards | auth.users, company_memberships, drivers, invoices, next_invoice_number | No | No | driver-workspace-contract.spec.ts | CLOSED | None. |
| /api/driver/finance/jobs/[jobId]/generate-invoice | POST | Yes | owner, admin | Yes | Zod | auth.users, companies, company_memberships, drivers, invoices, job_commercial_agreements, jobs, next_invoice_number | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/finance/jobs/eligible | GET | Yes | owner, admin | Yes | Manual guards | auth.users, company_memberships, drivers, invoices, jobs | No | No | driver-workspace-contract.spec.ts | CLOSED | None. |
| /api/driver/jobs/[jobId]/notes | POST | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, drivers, job_notes, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/location | POST | Yes | None detected | Yes | Manual guards | auth.users, driver_locations, drivers | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/bids | POST | Yes | None detected | Yes | Manual guards | job_bids, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/config | GET | No | Public | Public flow | Manual guards | — | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/device-token | POST | Yes | None detected | Yes | Manual guards | drivers | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/jobs/[id]/[action] | POST | Yes | None detected | Yes | Manual guards | jobs, pod-photos | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/jobs/[id] | GET | Yes | None detected | Yes | Manual guards | jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/jobs | GET | Yes | None detected | Yes | Manual guards | jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/nearby-jobs | GET | Yes | None detected | Yes | Manual guards | companies, drivers, jobs, vehicles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/mobile/resources | GET, POST | Yes | None detected | Yes | Manual guards | auth.users, companies, driver-docs, driver_documents, drivers, invoices, job_bids, jobs, notification_events, vehicles | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/password | POST | Yes | None detected | No/Not explicit | Manual guards | auth.users, drivers | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/search-loads | GET | Yes | None detected | Yes | Manual guards | auth.users, drivers, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/driver/vehicles | GET, POST, PATCH | Yes | None detected | Yes | Zod | auth.users, drivers, vehicles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |

## Finance / Jobs / POD

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/finance/invoice-document-url | GET | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, invoice-docs, invoice_documents, invoices, jobs | No | No | finance-workspace-contract.spec.ts | CLOSED | None. |
| /api/finance/invoices/[id] | GET | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, invoice_disputes, invoice_documents, invoice_payment_history, invoice_status_history, invoices, jobs | No | No | finance-workspace-contract.spec.ts | CLOSED | None. |
| /api/jobs/create | POST | Yes | owner, admin, dispatcher, broker, customer | Yes | Zod | auth.users, company_memberships, jobs | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/pod/signed-url | GET | Yes | None detected | Yes | Manual guards | auth.users, company_memberships, jobs, pod-photos | No | No | driver-workspace-contract.spec.ts | CLOSED | None. |

## Onboarding

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/onboarding/broker/session | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/customer/session | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/documents | POST | Yes | Public | Public flow | Zod | auth.users, companies, company_documents, driver_identity_documents, onboarding-documents, onboarding_applications | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/onboarding/fleet/session | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/individual-driver/session | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/init | POST | Yes | Public | Public flow | Zod | auth.users, notification_events, onboarding_applications | No | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/onboarding/owner-driver/session | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/session | GET, PATCH | Yes | Public | Public flow | Manual guards | auth.users, onboarding_applications | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/onboarding/submit/broker | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/submit/customer | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/submit/fleet | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/submit/individual-driver | POST | Yes | Public | Public flow | Zod | auth.users, onboarding_applications, submit_individual_driver_onboarding | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/onboarding/submit/owner-driver | GET | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |
| /api/onboarding/submit | POST | No | Public | Public flow | None detected | — | No | No | — | PARTIAL | Add schema validation and contract tests. |

## Public / Support

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/public/quote-request | POST | No | Public | Public flow | Zod | companies, quotes | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/support/tickets | POST | Yes | Public | Public flow | Zod | auth.users, company_memberships, drivers, profiles, support_tickets | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |

## Super-admin

| Endpoint | Methods | Auth required | Role check | Company isolation | Input validation | DB objects | Audit | Notifications | Tests | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/super-admin/audit | GET | Yes | owner | Yes | Manual guards | auth.users, companies, owner_audit_log, profiles | Yes | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/companies/[id] | PATCH | Yes | owner | Yes | Zod | auth.users, companies, profiles | Yes | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/companies | GET | Yes | owner | Yes | Manual guards | auth.users, companies, owner_audit_log, profiles | Yes | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/compliance | GET, PATCH | Yes | owner, driver | Yes | Zod | auth.users, companies, driver_documents, drivers, owner_audit_log, profiles, vehicle_documents, vehicles | Yes | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/email-readiness | GET | Yes | owner | No/Not explicit | Zod | app_settings, auth.users, notification_events, profiles | Yes | Yes | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/finance | GET | Yes | owner | Yes | Manual guards | auth.users, companies, invoice_payment_history, invoices, profiles | No | No | super-admin.spec.ts | CLOSED | None. |
| /api/super-admin/marketplace/[id] | PATCH | Yes | owner | Yes | Zod | auth.users, profiles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/marketplace | GET | Yes | owner | Yes | Manual guards | auth.users, companies, job_bids, jobs, owner_audit_log, profiles | Yes | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/onboarding/[id] | PATCH | Yes | owner | Public flow | Zod | auth.users, profiles, review_onboarding_application_atomic | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/operations | GET | Yes | owner | Yes | Manual guards | auth.users, companies, driver_locations, drivers, job_bids, job_disputes, jobs, profiles, quotes | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/platform | GET | Yes | owner | No/Not explicit | Manual guards | auth.users, companies, drivers, invoices, job_bids, jobs, notification_events, profiles, quotes | No | Yes | super-admin.spec.ts | CLOSED | None. |
| /api/super-admin/settings | GET, PATCH | Yes | owner | No/Not explicit | Zod | auth.users, platform_feature_flags, platform_settings, profiles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/stats | GET | Yes | owner | No/Not explicit | Manual guards | auth.users, companies, drivers, invoices, jobs, profiles | No | No | — | PARTIAL | Add contract tests for happy-path, auth and isolation failures. |
| /api/super-admin/support | GET, PATCH, POST | Yes | owner | Yes | Zod | auth.users, companies, invoice_disputes, owner_audit_log, profiles, reviews, support_tickets | Yes | No | super-admin-support.spec.ts | CLOSED | None. |

## TOTALS

- Total API routes: 72
- CLOSED: 10
- PARTIAL: 62
