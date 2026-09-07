# XDrive Driver — Posted Job Flow Canonical Contract

Date: 2026-09-07
Workstream: XDrive Driver mobile / PR #510

## Purpose
This contract captures the user-demonstrated four-screen posted-job flow and the accompanying verbal walkthrough.
It is a functional reference, not a visual-copy instruction.
XDrive must preserve its own visual identity while giving the driver the full decision context for a posted load.

## Core rule
A marketplace job is one continuous operational object.
The list card, detail view, route preview, company/commercial context and quote form must preserve the same job context.
The driver must not have to hunt across unrelated screens to decide whether to quote.

## Stage 1 — marketplace card
The card must show enough information to identify and triage the job:
- posting company/member identity;
- public route as TOWN, OUTCODE;
- collection and delivery timing;
- requested vehicle;
- freight/load summary;
- published rate when the poster chose to publish one;
- quote state/action;
- tap on the card body opens job detail without submitting a quote.

## Stage 2 — posted-job detail
The opened job must retain the route and posting-company context and expose all safe pre-award information available from the job record.
Required detail groups:
- route summary and public collection/delivery areas;
- collection/delivery time windows;
- requested vehicle/body requirement;
- job distance and ETA when available;
- distance to collection when a trustworthy value is available;
- cargo/freight type;
- pallets and weight when supplied;
- load description;
- special requirements;
- access restrictions/site constraints;
- direct-delivery/no-co-load requirement when set;
- public commercial rate when published.

Private street addresses and private site contacts remain protected until award/allocation.
Do not invent missing values.

## Stage 3 — route preview
The same posted job must provide a route-preview action before quote.
The route view must use only safe public locations before award.
It should show, when available:
- distance to collection;
- load/journey distance;
- estimated journey time;
- route between public collection and delivery areas.
Back must return to the same job detail and preserve context.

## Stage 4 — company and commercial decision context
The driver must be able to assess who posted the work before quoting.
Show where verified data exists:
- posting company name;
- member/company code;
- payment terms attached to the job;
- verified XDrive member feedback/review summary;
- review count and average rating when available.

If the platform has no verified feedback data, show a neutral unavailable state rather than fabricated trust signals.
Payment reliability must never be inferred from unrelated private financial data.

Pre-award private phone/site-contact disclosure remains protected by XDrive privacy rules.
Messaging/contact affordances may only use an authorised production contract; do not invent an endpoint.

## Stage 5 — quote with preserved context
Opening Quote/Make Offer must not strip the job down to a disconnected form.
The quote screen must repeat the essential job context:
- posting company;
- reference;
- route and timings;
- requested vehicle;
- freight/load summary;
- distance/ETA when available;
- key requirements/description;
- payment terms/reputation context when available.
Then show rate and optional driver note controls.

## Post-award continuity
After award, the same job evolves into the full work order rather than becoming a separate conceptual object.
Full addresses, site contacts, multi-stop route, operational instructions, status lifecycle, documents and POD are revealed according to the authorised contract.

## XDrive differentiation
Do not copy CX layout, colours, typography, spacing, icons, labels or card composition pixel-for-pixel.
Copy the workflow value, not the protected presentation.
XDrive should be easier to scan and more operationally explicit while remaining recognisably XDrive.

## Current V3 gap snapshot at commit a90ad6aa
Already present:
- posting company/member identity;
- public TOWN, OUTCODE route;
- timings;
- requested vehicle;
- freight summary;
- published-rate support;
- card-body detail navigation;
- quote action and active-quote blocking;
- post-award full work order, route, lifecycle and POD.

Confirmed gaps before this contract is satisfied:
- posted-job detail does not surface job distance/ETA;
- posted-job detail does not surface pallets/weight/load description/special requirements/access restrictions;
- posted-job detail has no pre-award route-preview action;
- posted-job detail does not show payment terms;
- posted-job detail does not show verified member-review summary;
- quote form preserves route/vehicle/freight but loses richer job/company/commercial context.

## Validation gate
Before PR #510 can be considered merge-ready, physically verify on Preview that one real posted job can be followed from card → detail → route preview → back → company/commercial context → quote context without losing the selected job.
No quote must be submitted merely to test navigation.
No PASS from source inspection alone.