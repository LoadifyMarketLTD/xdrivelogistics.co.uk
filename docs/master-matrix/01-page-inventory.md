# Page Inventory Matrix

## Public

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | public | Real | Read-only | No | — | auth.session, auth.users | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /company | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /contact | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /cookies | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /forbidden | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /login | public | Real | Actionable | No | — | auth.users | CLOSED | None. |
| /auth/callback | public | Real | Actionable | Yes — auth.session | /api/onboarding/init | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /pending-approval | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /privacy | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /register | public | Real | Actionable | Yes — auth.users, profiles | /api/onboarding/init | auth.users, profiles | CLOSED | None. |
| /request-quote | public | Real | Actionable | No | /api/public/quote-request | — | CLOSED | None. |
| /reset-password | public | Real | Actionable | Yes — auth.session, auth.users | — | auth.session, auth.users | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /support/feedback | public | Real | Actionable | Yes — auth.session | /api/support/tickets | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /terms | public | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |

## Admin

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /admin | admin | Real | Read-only | No | — | auth.session, auth.users | CLOSED | None. |
| /admin/bids | admin | Real | Actionable | Yes — auth.session, job_bids_with_job_owner | /api/admin/bids/[]/accept, /api/admin/bids/[]/reject, /api/admin/bids/identities | auth.session, job_bids_with_job_owner | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /admin/broker-invitations | admin | Real | Actionable | Yes — auth.session | /api/broker/carrier-invitations/[], /api/carrier/broker-invitations | auth.session | CLOSED | None. |
| /admin/companies | admin | Real | Actionable | Yes — companies, company_memberships, profiles | — | companies, company_memberships, profiles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /admin/diary | admin | Real | Actionable | Yes — auth.session, drivers, jobs | /api/admin/jobs/[]/assign-driver, /api/admin/jobs/[]/transition | auth.session, auth.users, drivers, jobs | BROKEN | Fix broken route/API target(s): /admin/post-load. |
| /admin/dispatchers | admin | Real | Actionable | Yes — companies, company_memberships | /api/admin/dispatchers | companies, company_memberships | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /admin/disputes | admin | Real | Actionable | No | — | job_disputes | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /admin/documents | admin | Real | Actionable | Yes — driver_documents, drivers, vehicle_documents, vehicles | — | driver_documents, drivers, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /admin/documents/expiry | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/driver-availability | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/drivers | admin | Real | Actionable | Yes — companies, drivers | /api/admin/drivers | companies, drivers | CLOSED | None. |
| /admin/drivers-vehicles | admin | Real | Read-only | No | — | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /admin/finance/balances | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /admin/finance/payments | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /admin/finance/reports | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /admin/fleet | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /admin/fleet/active-jobs | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/fleet/assignments | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/fleet/future-availability | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/fleet/maintenance | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/fleet/positions | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/incidents | admin | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /admin/invoices | admin | Real | Read-only | No | — | — | CLOSED | None. |
| /admin/invoices/new | admin | Real | Actionable | Yes — invoices, jobs, next_invoice_number | — | invoices, jobs, next_invoice_number | CLOSED | None. |
| /admin/invoices/[id] | admin | Real | Actionable | Yes — auth.session, invoice_payment_history, invoice_status_history, invoices, next_invoice_number | /api/admin/invoices/[]/lifecycle, /api/admin/invoices/[]/payment-history, /api/driver/finance/invoices/[]/submit | auth.session, invoice_payment_history, invoice_status_history, invoices, next_invoice_number | CLOSED | None. |
| /admin/jobs | admin | Real | Actionable | Yes — companies, job_documents, jobs, load-documents | — | companies, job_documents, jobs, load-documents | CLOSED | None. |
| /admin/jobs/[id] | admin | Real | Actionable | Yes — auth.session, drivers, jobs | /api/admin/jobs/[]/assign-driver | auth.session, drivers, jobs | CLOSED | None. |
| /admin/marketplace | admin | Real | Actionable | Yes — companies, job_bids, jobs | — | companies, job_bids, jobs | CLOSED | None. |
| /admin/notifications | admin | Real | Read-only | No | — | auth.session, auth.users, notification_events | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /admin/operations-centre | admin | Real | Actionable | Yes — auth.session | /api/admin/jobs/[]/transition, /api/admin/operations-centre | auth.session | CLOSED | None. |
| /admin/quotes | admin | Real | Actionable | Yes — bootstrap_company_membership, companies, company_memberships, get_or_create_company_for_user, jobs, quotes | — | bootstrap_company_membership, companies, company_memberships, get_or_create_company_for_user, jobs, quotes | CLOSED | None. |
| /admin/returns | admin | Real | Actionable | Yes — drivers, return_journeys | — | drivers, return_journeys | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /admin/settings | admin | Real | Actionable | Yes — auth.users, companies, company_settings | — | auth.users, companies, company_settings | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /admin/vehicles | admin | Real | Actionable | Yes — companies, drivers, vehicles | — | companies, drivers, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |

## Broker

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /broker | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /broker/awards | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /broker/bids | broker | Real | Actionable | Yes — auth.session | /api/customer/bids/[]/award | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /broker/carrier-costs | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /broker/carrier-costs/[id] | broker | Real | Read-only | Yes — auth.session | /api/finance/invoice-document-url, /api/finance/invoices/[] | auth.session | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /broker/carrier-network | broker | Real | Actionable | Yes — auth.session | /api/broker/carrier-invitations | auth.session | CLOSED | None. |
| /broker/compare-quotes | broker | Real | Actionable | Yes — auth.session | /api/customer/bids/[]/award | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /broker/customer-invoices | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /broker/customer-invoices/[id] | broker | Real | Read-only | Yes — auth.session | /api/finance/invoice-document-url, /api/finance/invoices/[] | auth.session | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /broker/customers | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /broker/disputes | broker | Real | Actionable | Yes — auth.session, job_disputes | /api/broker/disputes/[] | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, job_disputes, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /broker/jobs | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /broker/loads | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /broker/margins | broker | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /broker/notifications | broker | Real | Read-only | No | — | auth.session, auth.users, notification_events | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /broker/pod-review | broker | Real | Actionable | Yes — auth.session | /api/broker/pod-review/[], /api/pod/signed-url | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /broker/post-load | broker | Real | Read-only | No | — | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /broker/settings | broker | Real | Actionable | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | companies, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /broker/team | broker | Real | Actionable | Yes — auth.session | /api/customer/team | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |

## Customer

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /customer | customer | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | CLOSED | None. |
| /customer/awards | customer | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /customer/deliveries | customer | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /customer/documents | customer | Real | Actionable | Yes — auth.session | /api/broker/pod-review/[], /api/pod/signed-url | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /customer/invoices | customer | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /customer/invoices/[id] | customer | Real | Read-only | Yes — auth.session | /api/finance/invoice-document-url, /api/finance/invoices/[] | auth.session | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /customer/jobs/[id] | customer | Real | Actionable | Yes — auth.session, job_tracking_events | /api/customer/bids/[]/award, /api/pod/signed-url | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, job_tracking_events, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /customer/loads | customer | Real | Read-only | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and trim shared hook payloads to page-specific needs. |
| /customer/notifications | customer | Real | Read-only | Yes — notification_events | — | auth.session, auth.users, notification_events | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /customer/post-load | customer | Real | Read-only | No | — | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /customer/quotes | customer | Real | Actionable | Yes — auth.session | /api/customer/bids/[]/award | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /customer/settings | customer | Real | Actionable | Indirect — useCompanyWorkspaceData (driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles) | — | companies, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /customer/team | customer | Real | Actionable | Yes — auth.session | /api/customer/team | auth.session, driver_documents, driver_locations, drivers, invoices, job_bids, jobs, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /customer/updates | customer | Real | Read-only | Yes — notification_events | — | auth.session, auth.users, notification_events | PARTIAL | Add route-level tests and tighten loading/error/empty states. |

## Driver

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /driver | driver | Real | Read-only | Indirect — useCompanyWorkspaceData | — | — | CLOSED | None. |
| /driver/availability | driver | Real | Actionable | Yes — driver_availability_slots, drivers, vehicles | — | driver_availability_slots, drivers, vehicles | CLOSED | None. |
| /driver/change-password | driver | Real | Actionable | Yes — auth.session | /api/driver/password | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /driver/documents | driver | Real | Actionable | Yes — driver-docs, driver_documents, drivers | — | driver-docs, driver_documents, drivers | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /driver/finance | driver | Real | Actionable | Yes — auth.session | /api/driver/finance/invoices, /api/driver/finance/jobs/[]/generate-invoice, /api/driver/finance/jobs/eligible | auth.session | CLOSED | None. |
| /driver/finance/invoices/[id] | driver | Real | Actionable | Yes — auth.session | /api/driver/finance/invoices/[], /api/driver/finance/invoices/[]/disputes, /api/driver/finance/invoices/[]/documents, /api/driver/finance/invoices/[]/payment-history, /api/driver/finance/invoices/[]/submit | auth.session | CLOSED | None. |
| /driver/history | driver | Real | Read-only | No | — | jobs | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /driver/jobs | driver | Real | Actionable | No | — | drivers, jobs | CLOSED | None. |
| /driver/jobs/[id] | driver | Real | Read-only | Yes — driver_update_job_status_atomic, jobs, pod-photos | — | auth.session, auth.users, driver_update_job_status_atomic, jobs, pod-photos | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /driver/loads | driver | Real | Actionable | Yes — job_bids, jobs | — | job_bids, jobs | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /driver/loads/search | driver | Real | Actionable | No | — | jobs | BROKEN | Fix broken route/API target(s): /driver/loads/[], /driver/loads/saved. |
| /driver/messages | driver | Real | Read-only | No | — | notification_events | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /driver/more | driver | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /driver/notifications | driver | Real | Read-only | No | — | auth.session, auth.users, notification_events | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /driver/profile | driver | Real | Actionable | No | — | drivers | CLOSED | None. |
| /driver/quotes | driver | Real | Actionable | No | — | job_bids | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /driver/returns | driver | Real | Actionable | Yes — drivers, return_journeys | — | drivers, return_journeys | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /driver/vehicles | driver | Real | Read-only | Yes — auth.session | /api/driver/vehicles | auth.session | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /driver/won-work | driver | Real | Read-only | No | — | jobs | PARTIAL | Add route-level tests and tighten loading/error/empty states. |

## M/Mobile

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /m | m mobile | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /m/jobs | m mobile | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /m/jobs/[id] | m mobile | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /m/driver | m mobile | Real | Actionable | Yes — driver_documents, job_bids, job_notes, jobs, pod-photos, vehicles | — | auth.session, auth.users, driver_documents, job_bids, job_notes, jobs, pod-photos, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /m/driver/active | m mobile | Real | Actionable | Yes — auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events | — | auth.session, auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events, pod-photos, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /m/driver/documents | m mobile | Real | Actionable | Yes — auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events | — | auth.session, auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events, pod-photos, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /m/driver/jobs | m mobile | Real | Actionable | Yes — auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events | — | auth.session, auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events, pod-photos, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /m/driver/messages | m mobile | Real | Actionable | Yes — auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events | — | auth.session, auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events, pod-photos, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /m/driver/quotes | m mobile | Real | Actionable | Yes — auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events | — | auth.session, auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events, pod-photos, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /m/driver/settings | m mobile | Real | Actionable | Yes — auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events | — | auth.session, auth.users, driver_documents, drivers, job_bids, job_notes, jobs, messages, notification_events, pod-photos, vehicle_documents, vehicles | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |

## Onboarding

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /onboarding | onboarding | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /onboarding/[token] | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/session, /api/onboarding/documents, /api/onboarding/*/session, /api/onboarding/submit/* | auth.session | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /onboarding/broker/[token] | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/broker/session, /api/onboarding/submit/broker | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /onboarding/broker/resume | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/broker/session, /api/onboarding/submit/broker | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /onboarding/customer/[token] | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/customer/session, /api/onboarding/submit/customer | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /onboarding/customer/resume | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/customer/session, /api/onboarding/submit/customer | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /onboarding/fleet/[token] | onboarding | Real | Read-only | No | — | — | PARTIAL | Add redirect regression tests and document the canonical token route. |
| /onboarding/fleet/resume | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/session, /api/onboarding/documents, /api/onboarding/*/session, /api/onboarding/submit/* | auth.session | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /onboarding/individual-driver/resume | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/documents, /api/onboarding/individual-driver/session, /api/onboarding/submit/individual-driver | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /onboarding/owner-driver/[token] | onboarding | Real | Read-only | No | — | — | PARTIAL | Add redirect regression tests and document the canonical token route. |
| /onboarding/owner-driver/resume | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/session, /api/onboarding/documents, /api/onboarding/*/session, /api/onboarding/submit/* | auth.session | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /onboarding/resume | onboarding | Real | Actionable | Yes — auth.session | /api/onboarding/init | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |

## Super-admin

| Page route | Role | Real or Placeholder | Read-only or Actionable | Direct Supabase | API routes used | DB objects | Status | Required fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /super-admin | super-admin | Real | Read-only | Yes — auth.session | /api/super-admin/platform, /api/super-admin/stats | auth.session | CLOSED | None. |
| /super-admin/analytics | super-admin | Real | Read-only | No | /api/super-admin/platform | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /super-admin/companies | super-admin | Real | Actionable | No | /api/super-admin/companies, /api/super-admin/companies/[] | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/companies/active | super-admin | Real | Read-only | No | /api/super-admin/companies | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /super-admin/companies/approvals | super-admin | Real | Actionable | No | /api/super-admin/companies, /api/super-admin/companies/[] | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/companies/compliance | super-admin | Placeholder | Read-only | No | /api/super-admin/compliance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/companies/suspended | super-admin | Real | Actionable | No | /api/super-admin/companies, /api/super-admin/companies/[] | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/companies/verification | super-admin | Real | Read-only | No | /api/super-admin/companies | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /super-admin/compliance/documents | super-admin | Real | Actionable | No | /api/super-admin/compliance | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/compliance/expiries | super-admin | Placeholder | Read-only | No | /api/super-admin/compliance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/compliance/insurance | super-admin | Placeholder | Read-only | No | /api/super-admin/compliance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/compliance/operator-licences | super-admin | Placeholder | Read-only | No | /api/super-admin/compliance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/finance/fees | super-admin | Placeholder | Read-only | No | /api/super-admin/finance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/finance/invoices | super-admin | Placeholder | Read-only | No | /api/super-admin/finance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/finance/payments | super-admin | Placeholder | Read-only | No | /api/super-admin/finance | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/finance/revenue | super-admin | Real | Read-only | No | /api/super-admin/finance | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /super-admin/health | super-admin | Real | Read-only | Yes — auth.session, companies | /api/super-admin/compliance, /api/super-admin/email-readiness, /api/super-admin/finance, /api/super-admin/operations, /api/super-admin/stats | auth.session, companies | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /super-admin/marketplace | super-admin | Real | Actionable | No | /api/super-admin/marketplace, /api/super-admin/marketplace/[] | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/notifications | super-admin | Placeholder | Read-only | No | /api/super-admin/platform | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/active-jobs | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/allocations | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/completed-jobs | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/deliveries | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/disputes | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/driver-availability | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/fleet-positions | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/jobs | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/pending-jobs | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/pods | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/operations/quotes | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/settings/audit-logs | super-admin | Placeholder | Read-only | No | /api/super-admin/audit | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/settings/feature-flags | super-admin | Real | Actionable | No | /api/super-admin/settings | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/settings/global | super-admin | Real | Actionable | No | /api/super-admin/settings | — | PARTIAL | Add route-level tests and harden mutation success/error handling. |
| /super-admin/settings/roles-permissions | super-admin | Real | Actionable | Yes — auth.session | /api/super-admin/settings | auth.session | PARTIAL | Add route-level tests and move client-side writes behind validated server contracts. |
| /super-admin/support/complaints | super-admin | Placeholder | Read-only | No | /api/super-admin/support | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/support/disputes | super-admin | Placeholder | Read-only | No | /api/super-admin/support | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/support/tickets | super-admin | Real | Actionable | No | /api/super-admin/support | — | CLOSED | None. |
| /super-admin/users | super-admin | Real | Read-only | No | /api/super-admin/stats | — | PARTIAL | Add route-level tests and tighten loading/error/empty states. |
| /super-admin/users/company-owners | super-admin | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/users/customers | super-admin | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/users/dispatchers | super-admin | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/users/drivers | super-admin | Placeholder | Read-only | No | /api/super-admin/operations | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |
| /super-admin/users/platform-admins | super-admin | Placeholder | Read-only | No | — | — | PLACEHOLDER | Replace static stub with real data flow or remove from navigation. |

## TOTALS

- Total pages: 165
- CLOSED: 32
- PARTIAL: 92
- PLACEHOLDER: 39
- BROKEN: 2
