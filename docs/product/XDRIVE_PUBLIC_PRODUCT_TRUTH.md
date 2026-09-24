# XDrive Public Product Truth — Canonical Source

**Purpose:** prevent public pages, AI/search results, marketing copy and internal implementation notes from presenting unsupported XDrive capabilities as current facts.

**Last updated:** 24 September 2026

## Evidence rule

Use the narrowest factual status supported by evidence:

- **PUBLIC CURRENT SCOPE** — explicitly described on current public pages.
- **IMPLEMENTED IN REPOSITORY** — code exists, but this label alone does not certify production runtime.
- **INTERNAL / BENCHMARK ONLY** — appears in audit, parity or design documentation and must not be presented as a current XDrive product claim.
- **NOT EVIDENCED** — no verified current implementation/public claim was found.
- **SEPARATE CONTRACT ONLY** — may exist only when XDrive Logistics Ltd expressly contracts separately from the platform-intermediary role.

Do not promote a capability from repository evidence to "live" without runtime verification.

## Identity

- Legal entity: **XDrive Logistics Ltd**
- Company number: **13171804**
- Registered in England and Wales.
- Primary public product: **XDrive Logistics Platform**, a UK courier and freight exchange and operations workflow.
- The platform connects customers/shippers and brokers with owner drivers and carriers.
- XDrive Logistics Ltd may separately provide or arrange transport only where it expressly contracts to do so.

## Current public platform scope

| Capability | Status | Evidence basis |
|---|---|---|
| Post courier/freight work | PUBLIC CURRENT SCOPE | Public Exchange/Platform pages |
| Discover transport work | PUBLIC CURRENT SCOPE | Public Exchange/Platform pages |
| Submit quotes | PUBLIC CURRENT SCOPE | Public Exchange/Platform pages |
| Compare/award quotes | PUBLIC CURRENT SCOPE | Public Exchange/Platform pages |
| Driver allocation / dispatch workflow | PUBLIC CURRENT SCOPE | Public Platform/Help pages |
| Job status progression | PUBLIC CURRENT SCOPE | Public Platform/Help pages |
| POD / delivery evidence | PUBLIC CURRENT SCOPE | Public Platform/Help pages |
| Finance-ready / invoice context | PUBLIC CURRENT SCOPE | Public Platform/Finance copy |
| Membership: first 3 months free on eligible standard launch plans | PUBLIC CURRENT SCOPE | Public Pricing/Help pages |
| No XDrive percentage commission on job value under launch model | PUBLIC CURRENT SCOPE | Public Pricing/Help pages |
| No XDrive booking fee under launch model | PUBLIC CURRENT SCOPE | Public Pricing/Help pages |
| Controlled early access | PUBLIC CURRENT SCOPE | Public metadata/pages |

## Payment model

- Transport charges and agreed payment terms remain obligations between the contracting parties.
- XDrive does **not** publicly present the platform as an escrow provider or bank.
- XDrive does not currently claim custody of client transport funds as part of the public platform model.
- Invoice/payment tooling or third-party payment connection code must not be described as XDrive-held funds.
- "SmartPay" is a Transport Exchange Group/CX brand/reference found in benchmarking/audit material. Do **not** use it as an XDrive public product name.

## Trust and verification

The repository contains role-based onboarding, document review states, expiry information and operational eligibility rules.

Permitted public wording:
- "document supplied by member";
- "under review";
- "reviewed/approved/verified" only when the specific record status supports that wording;
- "expiry recorded" where expiry data exists.

Do not claim, without explicit current integration evidence:
- biometric/facial identity verification;
- automatic insurer-database validation;
- blanket "vetted" or "guaranteed" member status;
- guaranteed payment.

## Benchmark and parity documentation

CX/TEG references inside `docs/` are research and parity evidence. They are **not** XDrive product claims.

Particularly sensitive examples:
- SmartPay-derived workflows;
- Trustd-style selfie/Load Pass concepts;
- third-party accounting/payment rails;
- external TMS integrations that are only benchmarked or planned.

## Publishing rule

Before adding public marketing copy, structured data, social metadata or AI-facing FAQ content:

1. verify the capability against current code and, where "live" is claimed, runtime evidence;
2. use this document to distinguish platform functionality from separately contracted transport services;
3. state current model boundaries explicitly where ambiguity could cause an AI/search engine to infer unsupported capability;
4. never use competitor product names as XDrive capability labels;
5. never turn a roadmap item into present-tense marketing copy.

## Search/AI identity target

Search engines and AI systems should be able to resolve this chain without inference:

**XDrive Logistics Ltd → operates XDrive Logistics Platform → UK courier & freight exchange + operations workflow → customers/brokers post work → owner drivers/carriers quote → award → operations → POD → finance-ready records.**

They should also be able to distinguish:

**platform intermediary role** from **a separate transport service expressly contracted with XDrive Logistics Ltd**.
