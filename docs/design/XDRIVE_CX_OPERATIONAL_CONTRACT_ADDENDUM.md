# XDrive CX Operational Contract Addendum

## Status

This document codifies the authoritative operational/security semantics consolidated in PR #357 comment `5298583165`.

`docs/design/XDRIVE_WORKSPACE_CONSTRUCTION_MASTER_PLAN_v3.md` remains the visual/layout/workspace authority. This addendum is controlling where field visibility, Marketplace privacy, Diary/Job Sheet completeness, Directory semantics, Member Profile behaviour, or historical booking semantics were previously ambiguous.

## 1. Marketplace privacy boundary

The pre-award Marketplace must expose enough information to evaluate and quote a load, but not enough execution-site information to attend the collection or delivery without winning the work.

Canonical rule:

**Marketplace = sufficient for QUOTE.**

**Diary / Job Sheet = sufficient for EXECUTION.**

Before award, Driver Marketplace must not expose execution-private fields such as:

- exact collection or delivery street/site address when a less precise quote-safe location is available;
- collection or delivery site contact names;
- collection or delivery site phone numbers;
- customer reference, purchase-order reference or booking reference when these are execution/booking identifiers;
- access codes, gate instructions, named loading-bay contacts or similar execution-only instructions;
- private POD/paperwork instructions intended for the awarded booking.

The posting member is not anonymous. Marketplace may show the real public/business identity of the posting company/member, including where real and authorised:

- company/member name;
- Member ID / public member identifier;
- posted-by identity;
- public/business/dispatcher telephone number.

A collection/delivery site phone must never be substituted for the posting member's public/business phone.

## 2. Public quote notes vs private execution instructions

`Public Quote Notes` and `Private Execution Instructions` are different security classes.

Public Quote Notes may contain information legitimately required before award, for example quote constraints or a request to call the posting member before pricing.

Private Execution Instructions may contain gate codes, named collection/delivery contacts, loading-bay instructions, paperwork requirements or other information only required after award/allocation.

If XDrive does not currently have two independently safe persisted sources for these concepts, UI work must not guess which text is safe. No migration, RPC or schema change may be introduced by this workspace reconstruction. The missing separation must be treated as a real backend dependency and unsafe notes must not be surfaced pre-award.

## 3. Awarded booking / Order contract

`Order` is the structured awarded-booking confirmation view. `Notes` remains XDrive's existing note/history functionality and must not be used as a substitute for Order.

For awarded / allocated / accepted work, Order should surface existing real and authorised data where available:

- booking/job/load reference and booked timestamp;
- customer reference and PO where authorised;
- requested vehicle;
- allocated vehicle, body type and vehicle reference where real;
- subcontracted-by and subcontracted-to company identities where real and permitted;
- agreed rate;
- extras where a real source exists;
- historical payment terms where a booking-time/snapshot source exists;
- hard-copy POD requirement;
- Notes & Details that belong to the booking confirmation;
- exact pickup window, address, company and contact details;
- exact delivery window, address, company and contact details;
- booking footer / working instructions where a real historical source exists;
- POD, paperwork and other job-specific execution requirements.

Order is content-driven and may be tall. It must not be miniaturised to force a fixed record height.

## 4. Historical booking semantics

Current company settings are not automatically valid historical booking terms.

If payment terms, booking footer, charges or instructions are read from mutable current company settings, they must not be presented as the historical terms of an old booking unless a real booking-time snapshot or otherwise authoritative historical source exists.

If no historical source exists, show a truthful unavailable state instead of silently substituting current settings.

## 5. Driver Diary / Job Sheet completeness

Driver Diary is a critical operational surface. After a job is allocated to a driver, the authorised Job Sheet should expose all existing real information needed to execute the booking, including where available:

- exact pickup/delivery addresses and windows;
- booking/member/company/contact information;
- rate and authorised commercial confirmation data;
- refs;
- requested/allocated vehicle and body information;
- freight details including weight, pallets, dimensions, cargo value and packaging where stored;
- handling/access requirements;
- booking notes/details;
- POD/paperwork requirements;
- timeline/status history;
- driver notes;
- delivery receiver/signature/POD information;
- documents;
- invoice information where the role is authorised;
- feedback where real.

`Not supplied` / `Unavailable` is correct when a real field is absent. Production-looking invented values are forbidden.

The driver Job Sheet endpoint remains assignment-gated: execution-private detail may only be returned to the driver actually authorised for that job.

## 6. Shared Diary / Job Sheet architecture

Driver, Broker and Customer Diary must converge on a shared Job Sheet / Diary information architecture rather than three unrelated record designs.

The categories should be reusable, while each workspace sees only data and actions permitted for that role. Shared structure does not imply shared permissions.

## 7. Directory / Network semantics

`Directory` means a general member network, not merely companies already encountered through a user's own jobs.

Where backend permissions permit, Directory should support real searchable Companies and Drivers using relevant existing fields such as:

- Member ID;
- name/company;
- location/radius;
- vehicle/body type;
- services/capabilities.

A relationship register such as “companies that already quoted for this customer” may remain useful, but must not be labelled or treated as the global Directory if it is not one.

If backend permissions do not support a true global directory, report that dependency instead of fabricating one.

## 8. Member Profile

Member Profile is a fundamental reusable XDrive surface opened from relevant company/member identities in Marketplace, Directory and quote evaluation.

Where real data exists it may expose categories such as:

- Member Details;
- Feedback;
- Users;
- Specialist Services;
- Charges;
- Booking Footer;
- Business Documents.

Missing categories must show truthful `Not configured` / `Unavailable` states rather than invented CX-style metrics.

Do not derive unsupported metrics such as delivery performance, payment performance, complaint outcomes or “would use again” from a generic 1–5 rating.

Company and Owner Driver profiles must respect confidentiality. Public/business identity is not permission to expose a home address, private email, internal documents or execution-only data.

## 9. Fleet award and allocation contract

Carrier award and driver allocation are distinct operations and the existing canonical separation must be preserved.

For Fleet companies:

1. a quote may record both company and individual bidder identity;
2. acceptance awards the job contractually to the carrier company;
3. the job enters Fleet as won/received and unallocated;
4. the bidder driver may be recommended/preselected using real bidder identity;
5. Fleet management may select another eligible driver and, where supported, a suitable vehicle;
6. allocation produces the canonical allocated driver assignment;
7. only then does the job become that driver's personal execution job in Driver Jobs / Diary / Order;
8. Fleet continues to supervise company-level execution.

The Fleet UI must not claim backend validation of vehicle/body/payload/location/schedule compatibility that the existing allocation RPC does not actually perform. Readiness/matching may be displayed only from real existing data and must be labelled accurately.

## 10. Mandatory implementation order for this addendum

1. codify this addendum in design documentation;
2. enforce Marketplace privacy boundary;
3. expose posting-member public identity correctly;
4. resolve or explicitly block Public Quote Notes vs Private Execution Instructions on the actual backend contract;
5. implement the reusable Member Profile surface;
6. complete Driver Diary / awarded Job Sheet / Order using existing real fields;
7. bring Broker and Customer Diary onto the shared Job Sheet architecture with role-specific visibility;
8. correct Directory / Network semantics;
9. finish outstanding Fleet / Carrier contract deviations;
10. finish Customer workspace against Master Plan v3.

No later workspace may be marked GREEN by bypassing an earlier unresolved security/data-contract requirement in this sequence.

## 11. Hard boundaries

- no `/super-admin` changes;
- no direct `main` work or merge;
- no force-push/history rewrite;
- no migrations, schema, RPC or lifecycle changes in this reconstruction;
- no mock production data;
- no invented permissions or private-data exposure;
- Driver Loads business/quote eligibility must not be changed merely for visual convenience;
- final local PowerShell validation remains a final phase after implementation and strict repository audit, not a per-page blocker.
