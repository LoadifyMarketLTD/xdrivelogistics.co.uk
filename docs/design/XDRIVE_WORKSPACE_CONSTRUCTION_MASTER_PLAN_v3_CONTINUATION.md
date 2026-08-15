# XDRIVE LOGISTICS
# WORKSPACE CONSTRUCTION MASTER PLAN
## Master Execution Specification — v3 Continuation — Operational Privacy, Member Identity & Final Delivery Programme

**Status:** SUBORDINATE IMPLEMENTATION ADDENDUM TO `XDRIVE_WORKSPACE_CONSTRUCTION_MASTER_PLAN_v3.md` — it does not override or self-authorise changes outside the controlling Master Plan.

**Controlling specification:** `docs/design/XDRIVE_WORKSPACE_CONSTRUCTION_MASTER_PLAN_v3.md` remains authoritative for PR #357. Where this addendum conflicts with Master Plan v3, Master Plan v3 wins.

**Approved driver contract:** `docs/design/XDRIVE_CANONICAL_DRIVER_ELIGIBILITY_AWARD_CONTRACT.md` records the owner-approved driver/vehicle eligibility and Owner Driver/Fleet Driver award clarification. It is interpreted through Master Plan v3 and authorises only the minimum backend/data-path work demonstrably required to implement that approved contract.

**Branch:** `workspace-cx-matrix-v1`

**Hard boundary:** `/super-admin` is READ-ONLY and MUST NOT be modified.

**Merge boundary:** do not merge to `main` until the complete workspace programme has passed final repository audit and the single final local validation phase.

This continuation records operational privacy, member identity and diary/job-sheet requirements derived from the measured Courier Exchange reference set, repository audit and transport workflow review. It is guidance subordinate to Master Plan v3. It cannot by itself authorise DB/schema/RLS/auth/permission changes. Any such change must either be required by the owner-approved canonical driver contract or be documented as a separate blocker/approval decision.

---

# R. Execution ownership and delivery protocol

The workspace reconstruction is now executed as one programme rather than a sequence of independent page redesigns.

For every route:

1. read the relevant Master Plan section and this continuation;
2. inspect the relevant Courier Exchange reference images / `public/reference/courier-exchange/`;
3. inspect existing XDrive functionality and data sources;
4. identify privacy / permission boundaries before changing UI;
5. implement using shared workspace primitives where safe;
6. preserve real routing, statuses, bids, allocations, POD, invoices, tracking and permissions except for the minimum verified changes required by the owner-approved canonical driver eligibility/award contract;
7. self-audit the changed source and committed diff;
8. continue to the next route unless a concrete source/data/backend blocker prevents implementation.

During workspace implementation:

- hosted CI, Netlify preview state, GitHub billing and screenshot infrastructure are NOT pass/fail blockers;
- do not ask for repeated local PowerShell validation;
- source/diff review is the implementation gate;
- the final local lint/typecheck/tests/build/runtime phase happens ONCE after all workspaces and the final repository-wide audit.

No production-looking mock records are allowed. If a dataset does not exist or is not authorised, render an explicit unavailable / not supplied state.

---

# S. Marketplace privacy boundary — mandatory

The XDrive marketplace has two different information phases.

## S1. PRE-AWARD / QUOTE PHASE

Before a carrier / driver has won the job, the marketplace must expose enough information to decide whether to quote, but not enough information to bypass the platform and execute the transport without award.

### Pre-award fields that MAY be shown

- pickup town / broad location and outward postcode / quote-safe area;
- delivery town / broad location and outward postcode / quote-safe area;
- pickup / delivery date and time window;
- distance if available;
- requested vehicle / body requirement;
- cargo type;
- weight;
- pallet count;
- quote-safe dimensions where relevant;
- quote-safe handling requirements such as tail-lift, forklift, handball, ADR, temperature control, fragile, multi-drop / direct-delivery indicator;
- proposed price / budget only where the posting mode intends it to be visible;
- public quote notes;
- posting member / company identity;
- posting member ID / company number where authorised;
- business / dispatcher phone used for quote clarification where authorised;
- posted-by identity where the data source legitimately exposes it;
- payment terms only when they are intentionally part of the marketplace commercial offer;
- whether hard-copy POD is required if this affects pricing.

### Pre-award fields that MUST NOT be exposed

- exact collection street address;
- exact delivery street address;
- private site / gate / access instructions;
- collection contact name and phone;
- delivery contact name and phone;
- private customer references;
- purchase order numbers;
- booking references that reveal execution/customer identity;
- private execution notes;
- private document links;
- POD files;
- invoice details unrelated to quoting;
- customer personal data not required for the quote;
- any field that lets an unawarded driver go directly to the freight.

**Security rule:** this boundary must be enforced server-side / data-contract-side where possible. Hiding a field only in JSX while returning it to the browser is not considered compliant. A database/RLS change is not automatically authorised merely because this privacy objective exists; use the narrowest implementation compatible with Master Plan v3 and the approved business contracts.

## S2. AWARDED / EXECUTION PHASE

Once the driver is authorised to execute the job, the Job / Diary / Order Sheet may reveal the full execution dataset permitted to that driver:

- exact pickup / delivery address;
- contacts and phones;
- gate / access / collection / delivery instructions;
- booking and customer references required for execution;
- vehicle allocation;
- agreed rate and applicable extras where the role is authorised;
- paperwork and POD requirements;
- documents linked to the job;
- complete operational status history;
- delivery / POD evidence;
- invoice linkage where the driver is authorised.

A driver must never need to reconstruct the job from multiple unrelated screens after award.

---

# T. Public quote notes vs private execution instructions

A single undifferentiated `Operational notes` field is not an acceptable long-term contract because the author may enter either quote-safe information or confidential execution instructions.

The target conceptual model is:

- **Public Quote Notes** — visible on Marketplace before award;
- **Private Execution Instructions** — visible only to authorised awarded/allocated execution users;
- existing collection notes / delivery notes / access restrictions remain execution-scoped unless explicitly classified safe for quoting.

Implementation rule:

- never expose an existing mixed note field pre-award merely because it contains useful quote information;
- if the current database cannot safely distinguish the two classes, treat mixed notes as private by default and document the missing backend contract;
- do not invent a production migration against an unverified Supabase project.

---

# U. Member identity, Directory and Member Profile

Courier Exchange demonstrates that commercial trust is a first-class operational feature. XDrive therefore needs a reusable member identity contract.

## U1. Member identity surface

Company / carrier / broker / eligible Owner Driver names that appear in Marketplace, Quotes, Directory, Awards or Diary should use a consistent member identity component instead of plain text where the user is allowed to inspect the member.

Minimum identity fields when available and authorised:

- display name / company name;
- member / company number;
- member type: Fleet / Carrier / Broker / Owner Driver / Customer as applicable;
- town / business location;
- business phone;
- member-since date if the source is authoritative;
- account / compliance state suitable for the viewer.

Owner Driver privacy must be stricter than company privacy: do not expose personal home address, private email, private phone or internal compliance documents simply because those fields exist in the database.

## U2. Member Profile overlay / page

Target shared sections, shown only when real data exists:

- Member Details;
- Feedback;
- Users / Contacts;
- Specialist Services;
- Charges;
- Booking Footer / working instructions;
- Business Documents.

These sections are functional categories, not permission to fabricate Courier Exchange metrics.

Do NOT invent:

- Delivery Performance;
- Payment Performance;
- “would definitely use again” counts;
- complaints upheld;
- specialist certifications;
- waiting/loading/cancellation charges;
- booking footer rules;
- insurance status.

If XDrive does not expose a trustworthy dataset, show `Not configured`, `Not supplied`, or omit the section according to the page contract.

## U3. Directory meaning

`Directory` means the authorised searchable member network, not merely a list of companies that have previously quoted for the current customer.

Relationship registers may remain useful, but must not be labelled as the platform Directory unless they search the authorised network.

Directory search should support, subject to available data / permissions:

- Member ID / reference;
- company / member name;
- location;
- radius;
- vehicle capability;
- body type;
- specialist services;
- member type;
- driver / company distinction where relevant.

---

# V. Diary / Job Sheet — common execution contract

Diary is not a simple history table. It is the searchable operational register and the canonical expandable job sheet.

All Diary implementations should converge on a shared record pattern while preserving workspace-specific permissions.

## V1. Collapsed record

Show the highest-value scan information:

- From;
- To;
- pickup / delivery timing;
- vehicle / cargo summary;
- member / customer context;
- current / final status;
- load / booking reference that is authorised;
- POD / feedback / invoice attention states where applicable.

## V2. Expanded record tabs / sections

Use a shared vocabulary where the workspace has access:

- Order;
- Notes;
- History;
- Documents;
- POD;
- Invoice;
- Feedback.

## V3. Order confirmation / job sheet

The execution sheet should use every available authoritative field before falling back to `Not supplied`:

- XDrive job / booking reference;
- booked / awarded / allocated timestamp;
- subcontracted by;
- subcontracted to / executing carrier or driver identity where authorised;
- business phone where authorised;
- agreed rate;
- extras;
- payment terms / commercial snapshot;
- requested vehicle;
- allocated vehicle / vehicle reference;
- cargo type;
- weight;
- pallets;
- dimensions;
- distance;
- body / handling requirements where represented by real data;
- hard-copy POD requirement;
- customer reference;
- PO number;
- exact pickup;
- exact delivery;
- site contacts;
- working instructions;
- paperwork instructions;
- complete timeline / status history;
- attached job documents;
- POD evidence;
- linked invoice;
- real feedback.

Do not hard-code `Not supplied` if an authoritative field already exists in `jobs`, accepted bid data, vehicle data, company data, tracking events, document records or an existing commercial snapshot.

## V4. Historical commercial integrity

Past jobs must not silently inherit new company settings.

For agreed rate, payment terms, cancellation / waiting charges, booking footer or other contractual details:

1. prefer a job-level or award-level historical snapshot;
2. use accepted-bid / award data where appropriate;
3. use current company settings only when clearly labelled as current, not historical;
4. if no historical source exists, show `Not supplied` / `Historical terms unavailable` rather than rewriting history.

---

# W. Workspace-specific completion requirements

## W1. Driver

Target order:

**Dashboard → Loads → Quotes → Jobs → Diary → Availability → Return Journeys → Account**

Additional mandatory corrections:

- Driver Loads remains the visual / workflow reference and must preserve the measured CX scan→expand→quote contract;
- Marketplace pre-award list/detail must keep private execution data out of unauthorised client payloads;
- driver quote permission must converge on `XDRIVE_CANONICAL_DRIVER_ELIGIBILITY_AWARD_CONTRACT.md`;
- company identity remains visible for trust / quote clarification where authorised;
- exact freight location and execution contacts remain hidden until award;
- Diary must use all available job-sheet data and keep Feedback/POD/Documents/Invoice real;
- no rewrite of unrelated canonical job lifecycle / POD logic unless required by a verified bug or the owner-approved award/allocation rule.

## W2. Broker

Broker Diary must become the same class of operational register as Driver Diary, adapted to Broker permissions.

Expanded Broker job record should expose real:

- customer;
- pickup/delivery;
- quote / award state;
- awarded carrier;
- margin / price data where authorised;
- tracking;
- POD;
- documents;
- invoice linkage;
- notes / instructions;
- history.

Broker Carrier Network must evolve from invitation-only presentation into the authorised carrier relationship / directory experience only if the backend actually exposes the required member data. Invitation records must not pretend to contain vehicle, document, rating or availability data they do not have.

## W3. Fleet / Carrier

Correct semantic drift before visual closure:

- define Active Jobs once and reuse it;
- use the canonical driver+vehicle operational eligibility contract for Owner Driver and Fleet Driver alike;
- a named Fleet Driver accepted bid auto-allocates to that bidder driver by default; only a company-level bid without a named bidder driver enters won/unallocated;
- Fleet reallocation, where allowed, must revalidate the replacement driver+vehicle and preserve commercial award history;
- vehicle readiness must not be inferred from `assigned_driver_id` alone;
- carrier operational metrics must be scoped to carrier-owned / carrier-won work correctly;
- shared operational rows / rails / tabs should replace duplicated local page structures only when no business logic is lost.

## W4. Customer

Customer workspace must converge on the common operational grammar rather than remain a collection of generic SaaS tables.

Required conceptual surfaces:

- Dashboard;
- Post Load;
- Loads;
- Quotes;
- Jobs / Deliveries;
- Diary;
- Companies / authorised Network;
- Finance;
- Account.

Customer Diary must become expandable and useful for post-booking operations, not only a status table.

Awarded commercial identity and currently assigned execution driver must remain separate; generic assignment is not proof of the original commercial winner.

Customer Companies / Network relationship history may exist separately, but must not be mistaken for the global/authorised Directory contract.

---

# X. Shared implementation primitives — target

Promote reusable primitives instead of creating new page-specific patch systems:

- WorkspaceShell / WorkspaceHeader / WorkspaceNav;
- PageHeader;
- SearchRail;
- FilterField;
- TabStrip;
- StatusStrip;
- OperationalRow;
- OperationalCell;
- RecordMetaBar;
- RecordExpandedPanel;
- JobSheetTabs;
- JobSheetOrderPanel;
- StatusBadge;
- CompactButton;
- CompactTable;
- EmptyState;
- PaginationBar;
- MemberIdentityLink;
- MemberProfileOverlay / MemberProfilePage;
- AccountSectionNav.

The implementation may reuse existing class names where they already satisfy this contract. Do not create duplicate primitives merely to match the names above.

---

# Y. Security and permission audit requirements

Before a route is GREEN, check:

- Does the browser receive any field the viewer should not see?
- Is the data contract enforced by API / RLS / server route where necessary?
- Is member identity intentionally public-to-members or merely accidentally selectable?
- Are document URLs authorised and short-lived where required?
- Are customer / site contacts hidden pre-award?
- Are private notes hidden pre-award?
- Are accepted bid / rate details restricted to authorised parties?
- Are Owner Driver personal details protected?
- Does a direct URL bypass the intended visibility state?
- Does the route rely on client-side filtering for a security boundary? If yes, it is not GREEN.

Security hardening must remain proportional to the approved contract. Do not redefine unrelated role permissions merely to make a UI route convenient.

---

# Z. Final programme order

The implementation programme after this continuation is:

1. freeze Master Plan v3 as controlling specification and the canonical driver eligibility/award contract as the approved business clarification;
2. converge Driver Marketplace quote eligibility on driver+vehicle readiness;
3. preserve/verify Marketplace pre-award privacy — list and detail;
4. preserve Marketplace posting member identity contract;
5. public quote notes vs private execution instructions — source/data contract;
6. shared Member Identity / Member Profile foundation using existing authorised data;
7. Driver Diary full job-sheet completion;
8. Broker Diary full job-sheet completion;
9. Customer Diary full job-sheet completion and award/execution identity correction;
10. authorised Directory / Network alignment;
11. Fleet / Carrier named-driver auto-allocation, company-bid unallocated flow and controlled reallocation semantics;
12. Customer operational workspace completion;
13. Broker remaining workspace completion;
14. shared CSS / primitive consolidation onto the measured Master Plan v3 baseline;
15. cross-workspace permission/privacy/lifecycle audit;
16. responsive source audit at 1920×1080, 1440×900, 1024, 768 and 390–430;
17. final repository-wide audit against Master Plan v3 + approved subordinate contracts + CX references;
18. one final local PowerShell validation: lint, typecheck, tests, production build and runtime smoke checks;
19. only after all gates are GREEN may merge/deployment be discussed.

`/super-admin` remains excluded from every implementation item above.

---

# FINAL CONTINUATION RULE

**Master Plan v3 controls the programme.**

**Marketplace gives enough information to QUOTE, never enough information to EXECUTE before award.**

**Only a canonically eligible driver with a canonically eligible vehicle may submit a driver-originated quote.**

**An accepted named-driver bid defaults execution to that bidder driver; a company-level bid without a named bidder driver is the normal won/unallocated Fleet case.**

**Diary / Job Sheet gives the authorised execution user everything required to EXECUTE after award.**

**Member Profile gives enough trustworthy information to VERIFY a trading member without exposing private personal data or fabricating performance/compliance facts.**
