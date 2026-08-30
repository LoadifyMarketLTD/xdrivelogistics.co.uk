# CX Customer Award + Tracking Parity Audit

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Scope: Customer quote comparison -> carrier award -> booking -> tracking -> POD notification

## Evidence basis

This pass re-audits the XDrive implementation against the supplied Courier Exchange reference material, especially:

- quote comparison / member inspection before award;
- award / booking confirmation;
- unsuccessful / accepted quote state;
- live booking progress;
- driver lifecycle updates;
- Freight Vision / tracking visibility;
- POD availability and notification after delivery.

No `/super-admin` code is modified by this audit.

## 1. Quote comparison

### Existing XDrive capability

`CustomerQuotesOperationalPage` already groups quotes by load and exposes:

- carrier/member identity;
- Fleet / Owner Driver profile entry point;
- quote price;
- price position, including Best price;
- quote message;
- submission time;
- quote status;
- Award and Reject actions.

Quotes are sorted by price per load.

### Member profile

`MemberProfile` exposes business-facing member identity only and deliberately excludes private address, private email, driver compliance data, internal company settings and document URLs.

The company member-profile API currently reports its Feedback section as `unavailable`. Therefore XDrive must **not invent a reputation/rating summary** in Customer Quotes until the reviews contract identifies the reviewed member/company unambiguously and exposes a privacy-safe aggregate.

### Verdict

- carrier identity / member profile: **KEEP**
- price comparison: **KEEP**
- message / submitted time / state: **KEEP**
- carrier reputation / feedback aggregate: **BLOCKED-BY-CONTRACT**
- carrier ETA / distance-to-pickup inside quote comparison: **BLOCKED-BY-CONTRACT**

Reason for ETA/distance blocker: the current `WorkspaceBid` contract contains bid/company/driver identity, monetary fields, message and timestamps, but no canonical bidder position, ETA or distance field. Do not derive fake ETA from unrelated location data.

## 2. Award / booking

`POST /api/customer/bids/[id]/award` is authoritative and safely guarded:

- authenticated user required;
- `bid_acceptance_workflow` feature flag required;
- bid and job must exist;
- actor must be an active `owner`, `admin` or `dispatcher` of the job-owning company;
- mutation delegates to `accept_job_bid_atomic`;
- conflict / authorization errors are surfaced rather than silently repaired client-side.

`accept_job_bid_atomic`:

- locks the bid and job;
- accepts one submitted bid;
- rejects remaining submitted bids for the load;
- writes `awarded_carrier_company_id`;
- advances the booking into allocated state;
- auto-assigns the appropriate owner-driver when the winning company has the canonical eligible driver.

### Gap

The current Customer Quotes UI performs Award immediately from the row. There is no explicit CX-close final decision review/confirmation surface summarising the selected member, price and load before the irreversible commercial award.

Verdict: **PARTIAL** at presentation/confirmation level; backend award contract is **KEEP**.

Do not replace the atomic award RPC. Add confirmation around it in a later UI patch.

## 3. Won-load notification

Migration `071_notification_architecture.sql` already defines `fn_notify_bid_accepted()`.

When a bid changes to `accepted`, it creates a `notification_events` row with:

- event type `bid_accepted`;
- bid id;
- job id;
- winning company id;
- `bidder_user_id` as the explicit recipient;
- accepted bid amount.

Migration `20260725161000_notification_events_to_notifications_bridge.sql` bridges recipient-scoped events into the user-facing `notifications` inbox and maps `bid_accepted` to:

- title: `Your bid was accepted`;
- accepted amount in the notification body when available.

The operational notification processor also implements `handleBidAccepted()` and sends a `Bid Accepted - XDrive Logistics` email to the winning bidder.

Therefore won-load notification parity is **structurally present for inbox + email**.

Runtime verdict remains **HOSTED VERIFICATION REQUIRED** until the relevant migrations, triggers, deployed Edge Function and provider configuration are verified in the hosted environment.

## 4. Driver execution / tracking

The canonical execution lifecycle remains:

`awarded/allocated -> on_my_way -> on_site_pickup -> loaded -> in_transit -> on_site_delivery -> delivered -> completed`

The driver atomic lifecycle enforces evidence gates:

- loading photo before `loaded`;
- delivery photo/document + recipient signature + recipient name before `delivered` when POD is required.

Customer tracking already consumes awarded / allocated / in-progress / completed jobs and exposes Upcoming, Live, Delayed, Delivered and Photo Evidence views.

Verdict: lifecycle/tracking base **KEEP**, runtime live-location/Freight Vision validation still required.

## 5. POD notification

Migration `071_notification_architecture.sql` creates `pod_uploaded` when a job transitions to delivered.

Important distinction:

- `pod_uploaded` uses `recipient_user_id = NULL` and is broadcast at company level;
- the `notification_events -> notifications` bridge intentionally skips rows with `recipient_user_id IS NULL`, so this event does **not** create a personal inbox row automatically;
- `supabase/functions/notify-operational-event/index.ts` explicitly implements `handlePodUploaded()`;
- that handler resolves the job-owning `company_id`, finds active `owner`, `admin` and `dispatcher` memberships, resolves their user emails, and sends `Job Delivered - POD Ready` using the shared idempotent Resend path.

This matches the important CX behaviour from the supplied reference: the load-poster side receives an email alert that the POD is ready, even though XDrive's user-facing inbox model remains recipient-scoped and does not duplicate company broadcast rows.

Verdict: **KEEP — STATIC CONTRACT**, with **HOSTED VERIFICATION REQUIRED** for deployed function/webhook/provider execution.

## 6. Safe next execution order

1. Add Customer Award confirmation UX around the existing atomic endpoint; do not alter the RPC.
2. Runtime-verify `bid_accepted` and `pod_uploaded` in the hosted notification pipeline when Supabase project access is available.
3. Keep member reputation BLOCKED until `reviews` has an unambiguous reviewed-member contract.
4. Keep quote ETA/distance BLOCKED until a canonical bidder-position/ETA contract exists.
5. Runtime-validate customer Tracking / Freight Vision against an actually allocated job.
6. Continue into contextual Customer/Carrier messaging only after the existing message authorization contract is audited.

## Non-negotiable safety conclusions

- Do not expose private member details merely to mimic CX.
- Do not infer rating/reputation from ambiguous `reviews.company_id` semantics.
- Do not calculate a bidder ETA from unrelated fleet location data.
- Do not bypass `accept_job_bid_atomic`.
- Do not confuse company-broadcast POD email with a recipient-scoped inbox notification.
