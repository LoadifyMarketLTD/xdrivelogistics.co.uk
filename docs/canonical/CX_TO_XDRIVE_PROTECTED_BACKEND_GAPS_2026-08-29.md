# CX → XDrive Protected Backend Parity Gaps

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Parent ledger: `docs/canonical/CX_TO_XDRIVE_PARITY_LEDGER_2026-08-29.md`
Status: ACTIVE — DO NOT IMPLEMENT SILENTLY

## Rule

These gaps are real CX functional-parity requirements, but completing them would cross a protected boundary: API authorisation, RLS, DB/schema contracts, cross-role visibility, lifecycle authority or notification delivery semantics.

The UI branch may expose verified existing data and may clearly mark unavailable capabilities. It must not fabricate data, weaken privacy, broaden roles or create service-role shortcuts merely to make the UI look complete.

Before implementation of any row below:
1. identify the authoritative data model;
2. audit existing RLS/API permission boundaries;
3. define the narrowest required role/capability change;
4. identify web/mobile/customer/broker/carrier impact;
5. add contract tests for auth, isolation and negative paths;
6. obtain explicit approval for the protected change;
7. implement separately and then resume UI parity.

## 1. Generic Freight Messenger

**CX requirement:** contextual messaging is accessible from multiple operational surfaces and roles.

**Verified XDrive today:**
- Driver messaging exists at `/driver/messages`.
- `/api/driver/messages` is deliberately participant-scoped.
- replies are allowed only inside an existing conversation with one verified counterpart;
- the endpoint cannot discover/contact arbitrary users;
- company membership is re-checked before service-role insertion.

**Gap:** Carrier/Fleet/Dispatcher/Customer/Broker do not yet have one verified generic cross-role Messenger contract.

**Protected impact:** recipient discovery, membership visibility, conversation creation, company isolation, service-role access, abuse controls.

**Verdict:** `BLOCKED-BY-CONTRACT` for generic cross-role creation; Driver existing-conversation messaging remains `KEEP`.

## 2. CX-style Load Alert matching and preferences

**CX requirement:** alerts can depend on location/home base/live GPS/return journey/vehicle suitability and channel preferences.

**Verified XDrive today:**
- recipient-scoped `notifications` inbox exists;
- Driver and shared company inboxes now expose a first-class `Load Alerts` view for real load-alert records;
- current `company_settings` persists only four email flags: new job, status change, invoice paid, bid received;
- marketplace, Nearby Exchange, Return Journeys and live location data exist separately.

**Gap:** no verified settings model currently represents granular radius/location, vehicle-size, live-position or return-journey alert rules and no audited generator joins those rules to marketplace loads.

**Protected impact:** DB preferences, background/event generation, location privacy, driver/fleet matching, notification recipient/channel semantics.

**Verdict:** inbox presentation `KEEP/PARTIAL`; alert rule generation and granular preferences `BLOCKED-BY-CONTRACT`.

## 3. Public member reputation / feedback projection

**CX requirement:** member feedback/reputation supports carrier selection and Directory/member-profile decisions.

**Verified XDrive today:**
- `reviews` exists and Driver Diary can read job-scoped review records;
- company Member Profile intentionally returns member-level feedback as unavailable;
- the current public member-profile endpoint exposes business identity only and explicitly withholds private compliance/user data.

**Gap:** the schema does not establish a reviewed-company field or an audited aggregation rule that safely maps reviews to a public company reputation score.

**Protected impact:** data semantics, privacy, moderation/abuse, RLS and public business-profile projection.

**Verdict:** `BLOCKED-BY-CONTRACT`; do not infer company reputation from ambiguous `reviews.company_id` semantics.

## 4. Customer pre-award ETA / distance comparison

**CX requirement:** customer/broker quote comparison can use price plus carrier/member context and operational suitability such as distance/ETA where legitimately available.

**Verified XDrive today:**
- customer quote comparison shows real carrier identity, quote price, delta vs lowest visible quote, message/terms and submitted time;
- live execution tracking exists after authorised award;
- pre-award carrier exact-location privacy is intentionally protected.

**Gap:** current customer quote projection does not expose an authoritative carrier-to-pickup ETA/distance field.

**Protected impact:** driver/carrier position privacy, tracking visibility, quote projection and location freshness semantics.

**Verdict:** `BLOCKED-BY-CONTRACT`; do not derive a fake ETA or reveal private coordinates.

## 5. Ready to Invoice eligibility queue

**CX requirement:** an explicit Ready to Invoice work queue based on completed transport/evidence readiness.

**Verified XDrive today:**
- invoice register supports Draft, Sent/Awaiting Payment, Overdue, Paid, Disputed and Cancelled;
- invoice detail supports lifecycle and payment history;
- Driver finance has an eligible-jobs endpoint for its own invoice-generation workflow.

**Gap:** the company accounting register does not yet expose one audited cross-role `Ready to Invoice` eligibility contract combining completed job state, POD/evidence and invoice absence.

**Protected impact:** job lifecycle authority, POD readiness rules, invoice ownership/customer-vs-carrier semantics.

**Verdict:** `BLOCKED-BY-CONTRACT` for a company-wide Ready-to-Invoice queue until eligibility rules are explicitly defined.

## 6. External invoice upload / batch invoicing / statements

**CX requirement:** accounting workflow may include external invoice records, batch operations and statements/export.

**Verified XDrive today:**
- invoice creation/detail/payment history exist;
- Event Log CSV export exists, but that is not a finance statement;
- no verified invoice-register contract was found for arbitrary external invoice upload or batch invoice mutation.

**Gap:** external-document ownership, reconciliation semantics, batch mutation and statement definition require dedicated finance contracts.

**Protected impact:** invoice/document storage, financial authority, audit trail, payment reconciliation.

**Verdict:** `BLOCKED-BY-CONTRACT` until each finance action has a verified API/data contract.

## 7. Customer complaint / Report Abuse parity

**CX requirement:** users can escalate feedback/complaint/abuse issues through an accountable workflow.

**Verified XDrive today:**
- broker-managed `job_disputes` has a real dispute register and broker resolve/escalate API;
- authenticated `/api/support/tickets` can create billing/operations/technical/compliance/general support tickets;
- platform-owner complaint tooling exists under `/super-admin` and is excluded from this branch.

**Gap:** there is no verified customer/carrier/driver `Report Abuse` domain contract connecting a trading relationship/job/review to the support/dispute lifecycle.

**Protected impact:** moderation, dispute ownership, evidence, platform-owner workflow and permissions.

**Verdict:** existing broker disputes `KEEP`; cross-role complaint/abuse workflow `BLOCKED-BY-CONTRACT`.

## 8. Telematics provider management

**CX requirement:** fleet tracking can integrate vehicle/telematics data sources.

**Verified XDrive today:** live driver positions and Freight Vision are functional using existing XDrive location data.

**Gap:** no audited provider credential/configuration contract has been established for third-party telematics integrations.

**Protected impact:** secrets, provider credentials, tracking source precedence, vehicle identity matching and retention.

**Verdict:** `BLOCKED-BY-CONTRACT`.

## Release rule

None of the rows above may be silently marked `KEEP` because a visually similar control was added. The final parity report must distinguish:
- UI/discoverability parity;
- existing-contract functional parity;
- protected backend gaps awaiting an approved implementation contract.
