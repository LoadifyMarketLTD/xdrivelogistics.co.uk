# Canonical Identity and Company Participation Contract

## Status

Product-owner decision. This contract is authoritative and must not be replaced by a generic multi-organisation membership model without explicit written product-owner approval.

## Core invariant

**One verified person may have one active XDrive identity and one active commercial relationship at a time.**

The platform is not an organisation-switching SaaS product. A user must not change between Company A, Company B and Company C from the same account.

## Allowed identities

### Company Driver

- Has a personal login.
- Is linked to one Fleet/Carrier company.
- Performs authorised work only in that company's name.
- May view marketplace jobs, submit quotations, receive direct jobs and use return-journey tools when the company grants the relevant permissions.
- Must not simultaneously act as a Company Driver for another company.
- Must not simultaneously operate an active Owner Driver identity.

### Fleet / Company Owner

- Owns or administers one company identity on XDrive.
- May create and manage authorised company users and drivers.
- May enter Driver Mode inside the same company when valid Driver evidence exists.
- Driver Mode changes the operational surface, not the company or commercial identity.

### Owner Driver / Owner Operator

- Operates under their own verified commercial identity.
- Has Owner and Driver responsibilities within that same identity.
- Must not simultaneously remain an active Company Driver for another fleet.

## Company membership rule

A company may contain many authorised users.

A user may have only one active `company_memberships` row across the platform.

If the database finds more than one active membership for a user, this is an identity-integrity incident. The platform must fail closed and send the case to Platform Owner review. It must not display an Organisation/Company switcher.

Historical disabled, suspended or closed relationships may remain for audit, but only one relationship may be active.

## Driver identity rule

An authenticated user may map to only one persistent `drivers` identity.

A legitimate transition from Company Driver to Owner Driver, or the reverse, must update or migrate the controlled identity after the previous relationship is closed. The platform must not create two simultaneously active driver identities.

## Marketplace fairness

For each job:

- one company may have one active quotation;
- all authorised users acting for that company share that single company quotation;
- an Owner, Dispatcher and Company Driver must not appear as separate competing carriers for the same company;
- an independent identity may have one active quotation;
- a quotation may be amended through the authorised update workflow rather than duplicated.

This prevents one person or company from creating artificial competition or doubling its chance of winning a job.

## Duplicate-account and document response

An exact cross-account document match must:

1. stop the new upload;
2. place the onboarding application on hold;
3. create a critical fraud-review case;
4. prevent approval while the hold exists;
5. require a recorded Platform Owner decision.

Probabilistic matches such as the same name, address or date of birth must create a manual-review alert rather than an automatic permanent ban.

## Platform Owner authority

The Platform Owner must be able to:

- view every company, identity, driver and vehicle compliance document through a short-lived secure link;
- see issue, expiry, upload and review dates where available;
- approve, reject or request changes;
- view duplicate-document and identity-conflict evidence;
- investigate, clear, dismiss or confirm a fraud case;
- suspend or block access after a documented decision;
- see an audit trail of every document view and compliance decision.

## Prohibited implementation patterns

- Organisation or Company switcher for ordinary users.
- Selecting the first membership when more than one active membership exists.
- Trusting client-supplied company, role, Driver or permission facts.
- Allowing two active bids from the same company for one job.
- Permanent automated fraud bans without human review and a recorded reason.
- Exposing permanent or public document URLs.
- Treating a missing company or document status as active or approved.

## Required transition behaviour

When a person changes from Company Driver to Owner Driver, or moves to another company:

1. the existing active relationship is closed or suspended;
2. marketplace and operational access under that identity is removed;
3. the new application and documents are verified;
4. any identity match is reviewed;
5. the new relationship becomes active only after approval;
6. historical jobs, ratings and decisions remain auditable and are not silently erased.

## Database enforcement

The canonical implementation must enforce at least:

- one active company membership per `user_id`;
- one persistent Driver identity per `user_id`;
- one active company quotation per `job_id` and `company_id`;
- one active independent quotation per `job_id` and `bidder_user_id`;
- approval blocked for identity-risk holds;
- approval blocked when mandatory documents are missing, unverified or expired.
