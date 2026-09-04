# XDrive Role Contractual Gate Architecture

Date: 2026-09-04
Status: implementation specification — not yet production legal sign-off
Scope: public registration, onboarding, membership activation, job-level contracting and audit evidence

## Purpose

XDrive must not rely on a single generic registration checkbox or on the Stripe billing flow as the primary contract formation point.

The first contractual gate belongs at registration immediately after the user chooses how they will use XDrive. The accepted agreements and declarations must then remain role-specific throughout onboarding and operational use.

The platform roles in scope are:

- Customer / Shipper
- Transport Broker
- Owner Driver
- Carrier / Fleet

The implementation must not introduce product-seller terminology into the public XDrive UX. XDrive is a transport/logistics platform and the UI should use the operational role names above.

## Contract stack

### 1. Core Platform Terms

Applies to every business account.

Covers platform access, account security, authority to act, acceptable use, suspension, platform availability, intellectual property, communications, disputes, governing law and baseline liability rules.

### 2. Membership & Subscription Terms

Applies to paid and trial memberships.

Covers plan selection, free trial, recurring billing, VAT, renewal, cancellation, payment failures and changes to paid membership terms.

This is not the sole platform contract and must not be presented as such.

### 3. Marketplace & Transport Trading Terms

Applies when users post, quote, award, accept, execute or administer transport work through XDrive.

Covers the point at which a job becomes binding, agreed price, VAT position, waiting time, cancellation, collection and delivery obligations, POD, claims, prohibited goods, insurance obligations, payment terms and dispute evidence.

Unless XDrive expressly contracts in writing to provide transport itself, these terms must preserve the distinction between XDrive as platform operator/intermediary and the users who are the contracting transport parties.

### 4. Role-specific terms

#### Customer / Shipper

Customer / Shipper Trading Terms must address authority to post work, accuracy of load information, lawful goods, pickup/delivery readiness, payment responsibility, claims information and use of carrier quotations.

#### Transport Broker

Broker Trading Terms must address authority to act for customers, accuracy of instructions, responsibility for information supplied, carrier engagement, commercial representations, payment obligations and restrictions on misuse of platform data.

#### Owner Driver

Owner Driver / Carrier Terms must address self-employed business use, document and identity verification, vehicle and insurance compliance, lawful operation, responsibility for accepted work, subcontracting where permitted, POD, claims and tax/compliance information.

The implementation must not state or imply that merely labelling a user self-employed determines employment status. Operational reality must remain consistent with the contract.

#### Carrier / Fleet

Carrier / Fleet Terms must address company authority, operator responsibility for invited drivers, vehicle and insurance compliance, allocation, subcontracting, driver conduct, POD, claims, licence/compliance obligations and responsibility for work accepted by the company.

## Registration contractual gate

The public `/register` page must remain visually clean but must replace the single generic acceptance checkbox with an `Agreements & declarations` block that changes with the selected role.

The user must take an affirmative action. No contractual checkbox may be pre-selected.

The primary submit action must remain disabled or fail closed until all mandatory acknowledgements for the selected role are complete.

### Common acceptance

Every role must explicitly accept:

- XDrive Platform Terms
- Membership & Subscription Terms
- Marketplace & Transport Trading Terms where the role can participate in transport transactions

The Privacy Policy is an acknowledgement/information notice, not bundled wording that says the user contracts by consenting to privacy processing.

### Authority declaration

Every business account must confirm that the person registering is authorised to create and operate the account for the stated business or, for an owner driver/sole trader, is authorised to act for themselves in that business capacity.

### Role declaration

Each role receives one concise role-specific declaration at registration. Detailed documentary verification belongs in onboarding, not in the first registration form.

Customer / Shipper:
`I confirm that I am authorised to create this account and that transport requirements and goods information I submit through XDrive will be accurate and lawful.`

Transport Broker:
`I confirm that I am authorised to create this broker account and to submit or manage transport requirements for the customers or businesses I represent.`

Owner Driver:
`I confirm that I am joining XDrive in a business capacity and understand that eligibility to undertake transport work is subject to identity, vehicle, insurance and compliance verification.`

Carrier / Fleet:
`I confirm that I am authorised to create this carrier account and that the company is responsible for the drivers, vehicles, insurance and compliance information it provides to XDrive.`

## Registration evidence model

A boolean such as `terms_accepted=true` is not sufficient as the long-term contract evidence model.

For every registration acceptance, XDrive should retain an append-only evidence record containing at minimum:

- evidence record UUID
- user ID once known
- company ID once known
- selected public role
- selected membership plan
- agreement code
- agreement version
- agreement effective date
- canonical document URL
- content hash / immutable document fingerprint
- exact acceptance statement presented to the user
- accepted UTC timestamp
- registration session/correlation ID
- privacy notice version acknowledged
- server-observed request metadata required for fraud/audit purposes, subject to privacy minimisation and retention rules

The record should be created server-side or be server-verifiable. Client-controlled metadata alone must not be treated as authoritative contract evidence.

## Versioning and re-acceptance

Each binding document needs a stable code and explicit version.

Recommended codes:

- `platform_terms`
- `membership_subscription_terms`
- `marketplace_transport_terms`
- `customer_shipper_terms`
- `broker_terms`
- `owner_driver_terms`
- `carrier_fleet_terms`

Material amendments must be capable of triggering required re-acceptance. The platform should preserve the previous accepted version rather than overwriting it.

Minor non-material copy corrections should not manufacture a new binding acceptance event unless legal review determines otherwise.

## Onboarding gate

Registration creates the contractual relationship for platform access. Onboarding then verifies whether the account is eligible for the operational capabilities associated with the chosen role.

Owner Driver and Carrier/Fleet onboarding should gate work-taking capabilities until required identity, business, vehicle, insurance and other applicable compliance documents are verified.

Customer/Shipper and Broker onboarding should verify business identity/authority and the operational/commercial information required for their role.

Contract acceptance must not be used as a substitute for compliance verification.

## Membership activation gate

The membership/Stripe step should record the commercial subscription transaction separately from the original platform contract acceptance.

It should evidence:

- selected plan
- price excluding VAT
- trial start/end
- renewal basis
- tax treatment presented by Stripe
- Stripe customer/subscription/session references
- subscription terms version in force at activation

The existing membership confirmation PDF is an evidence receipt, not the sole contract.

## Job-level contract record

When a transport job becomes awarded/accepted, XDrive should create an immutable or append-only commercial agreement snapshot tied to that job.

The snapshot should preserve at minimum:

- customer/broker contracting account
- carrier/owner-driver contracting account
- job reference
- collection and delivery data
- accepted price
- VAT/tax basis
- payment terms
- waiting/cancellation basis
- POD requirements
- special instructions incorporated into the agreement
- timestamp and actor for award
- timestamp and actor for acceptance where separate
- Marketplace & Transport Trading Terms version

Existing `job_commercial_agreements` functionality should be reused/extended rather than creating a competing source of truth.

## Privacy treatment

Do not write `I agree to the Privacy Policy` as though privacy processing depends entirely on contractual consent.

Use wording such as:
`I acknowledge that XDrive will process my information as described in the Privacy Policy.`

Separate optional marketing consent from mandatory contract formation and keep optional consent unbundled.

## Enterprise and negotiated agreements

Enterprise, bespoke, exclusive, direct procurement or other individually negotiated relationships can require a separately executed electronic agreement.

The standard self-service registration flow should not pretend to replace a negotiated enterprise agreement where commercial/legal terms differ materially from the public platform terms.

## Security and governance

- Fail closed if required agreements cannot be resolved to a known active version.
- Never allow the browser to choose an arbitrary agreement version.
- Resolve active versions server-side.
- Preserve historical agreement versions.
- Do not allow ordinary tenant admins to alter canonical XDrive legal text or acceptance evidence.
- Re-acceptance decisions should be controlled by Platform Owner/Super Admin governance but this workstream must not change `/super-admin` visuals.
- Do not store full card/bank credentials; Stripe remains the payment data processor for card details.

## Implementation sequence

1. Introduce a canonical role-to-agreement registry in source.
2. Update `/register` to show role-specific agreements and declarations with explicit unchecked controls.
3. Keep Privacy Policy acknowledgement separate from contractual acceptance.
4. Add server-side/append-only agreement acceptance persistence.
5. Add legal-document version registry and content hashes.
6. Add onboarding compliance gates by role.
7. Connect membership activation evidence to the accepted subscription terms version.
8. Reuse/extend job commercial agreement snapshots for job-level contract evidence.
9. Add material-change re-acceptance workflow.
10. Complete UK solicitor review of final binding wording before commercial launch.

## Release rule

This work must be developed and validated on a preview branch before integration to `main`. No production migration or production legal-text switch should occur until the schema, UI, evidence semantics and final legal wording have been reviewed together.
