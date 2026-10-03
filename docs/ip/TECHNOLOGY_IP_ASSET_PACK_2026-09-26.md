# XDrive Logistics Ltd — Technology & IP Asset Pack v1

**Evidence snapshot:** 26 September 2026  
**Canonical UK legal entity:** **XDrive Logistics Ltd**  
**Company number:** **13171804**  
**Jurisdiction:** England and Wales  

## 1. Purpose

This pack records the technology assets that can be evidenced from the current GitHub repositories and associated technical documentation.

It is designed to support:

- funding and lender due diligence;
- grant / innovation applications;
- accounting review of internally developed software;
- independent IP or software valuation;
- investor due diligence;
- chain-of-title preparation.

This is an **evidence pack**, not an independent monetary valuation. No asset value is assigned here unless separately supported by a qualified valuation or accounting exercise.

## 2. Legal ownership position

The canonical UK legal entity associated with the XDrive Logistics and Loadify Market technology assets is **XDrive Logistics Ltd (Company No. 13171804)**.

The GitHub namespace `XDriveLogisticsLtd` is a technical hosting namespace only. It is not a separate legal company and must not be treated as the legal owner or operator of the platforms.

Repository-level ownership records are maintained in:

- `docs/legal/LEGAL_ENTITY_AND_IP_OWNERSHIP.md`;
- `NOTICE.md`;
- repository README metadata.

Formal chain-of-title must additionally review any contractor, employee, design, content, domain, trademark, cloud or third-party licence agreements relevant to individual assets.

## 3. Group technology asset map

### A. XDrive Logistics platform

Primary repository:

`XDriveLogisticsLtd/xdrivelogistics.co.uk`

Current verified snapshot:

- current main SHA at evidence freeze: `c247ac48586548fb5e3187ebd2f19d0110098cc6`;
- repository created on GitHub: 13 February 2026;
- primary language: TypeScript;
- current repository visibility: public;
- approximately **1,942 files** and **666 directories**;
- **777** files under the main `app/` application surface;
- **236** files under `app/api/`;
- **388** current ordered Supabase migration files;
- approximately **376** test/E2E files;
- **186** documentation files.

Current stack evidenced from `package.json` and README includes:

- Next.js 15;
- React 19;
- TypeScript;
- Supabase;
- Tailwind / Radix UI;
- Playwright;
- Vitest;
- PDF generation;
- mapping / geospatial UI libraries.

Verified product-domain evidence includes:

- freight marketplace and load posting;
- quote / award workflows;
- bookings;
- customer, carrier, broker, fleet, driver and admin workspaces;
- driver / vehicle operations;
- return journeys and future positions;
- live tracking / ETA architecture;
- POD and evidence;
- documents;
- invoicing and payment-status workflows;
- disputes;
- messaging;
- alerts / notification infrastructure;
- compliance and event logging;
- mobile-driver backend APIs and device-session security controls.

The canonical transport lifecycle is documented in:
`docs/benchmarks/CX_ROLE_FUNCTION_MASTER_BLUEPRINT_2026-09-25.md`.

### B. Loadify Market platform

Primary repository:

`XDriveLogisticsLtd/loadifymarket.co.uk`

Current verified snapshot:

- current main SHA at evidence freeze: `58c928f544062701d4eb9f1d5ec73879c332ec3d`;
- repository created on GitHub: 2 November 2025;
- primary language: TypeScript;
- current repository visibility: public;
- approximately **1,982 files** and **163 directories**;
- **469** files under `src/`;
- **411** Netlify function files plus **104** modern runtime wrappers;
- **237** current ordered Supabase migration files;
- approximately **274** test/E2E files;
- **135** documentation files;
- **79** Android project files.

Current stack evidenced from `package.json`, README and architecture documentation includes:

- React 19;
- TypeScript;
- Vite;
- Supabase PostgreSQL/Auth/Storage/PostgREST/Realtime;
- Netlify Functions;
- Stripe Checkout and Stripe Connect;
- Resend;
- Capacitor Android;
- Vitest and Playwright.

Verified product-domain evidence includes:

- public marketplace and catalogue;
- buyer accounts;
- seller accounts;
- seller onboarding and readiness;
- product listing and media;
- stock / listing lifecycle;
- cart / checkout;
- Stripe-backed payments;
- seller payout surfaces;
- orders;
- shipping / tracking;
- returns / disputes;
- messaging;
- reviews;
- favourites / wishlist;
- notifications;
- supplier-commerce architecture;
- governed supplier offers;
- product sourcing / discovery;
- product intelligence;
- AI product-builder foundations;
- cross-border / multi-country readiness architecture;
- native Android marketplace surface.

Current architecture is documented in:
`docs/ARCHITECTURE.md`.

## 4. Supporting XDrive repositories

The following additional repositories are currently accessible and form supporting technical evidence:

### `XDriveLogisticsLtd/xdrivelogistics`

- visibility: public;
- approximately 109 files;
- legacy / supporting XDrive web application material;
- should not be double-counted as a separate full product valuation without code-overlap analysis.

### `XDriveLogisticsLtd/app.xdrivelogistics.co.uk`

- visibility: private;
- approximately 149 files;
- separate XDrive application surface with React/mobile-oriented components;
- must be evaluated for overlap with the primary XDrive repository before assigning separate value.

These repositories are evidence of development activity and product evolution, but they are not automatically separate intangible assets for accounting purposes.

## 5. Mobile XDrive evidence boundary

The current `main` tree of `xdrivelogistics.co.uk` does **not** presently contain the historical `apps/driver-mobile` or `android-native` source directories referenced by older audit documents.

However, the current repository still contains:

- mobile-driver API routes;
- driver mobile device-session database architecture;
- native-driver status RPCs;
- mobile feature controls;
- historical audits and execution evidence.

Therefore:

- the mobile-driver backend/software architecture is evidenced;
- a separate current-source claim for the native XDrive Android client must not be made until its canonical source repository or immutable historical source snapshot is identified.

This boundary protects the credibility of the pack.

## 6. Software-development evidence

Both primary repositories contain strong evidence of substantial custom engineering rather than simple static websites:

- extensive TypeScript application code;
- server/API layers;
- relational database migration histories;
- authentication and role architecture;
- security controls;
- tests and E2E suites;
- release / audit documentation;
- operational state machines;
- payment / finance logic;
- mobile support;
- production deployment configuration;
- security and compliance work;
- multi-role business workflows.

Pull-request histories and merge records provide an additional auditable trail of iterative development and remediation.

## 7. Distinct commercial assets

The two platforms should be treated as distinct products:

### XDrive Logistics
A logistics technology platform focused on freight exchange, transport operations, carrier/driver/fleet execution and commercial job closeout.

### Loadify Market
A commerce marketplace platform focused on buyer/seller transactions, supplier commerce, catalogue/order/payment/shipping/returns orchestration and marketplace governance.

They may share infrastructure concepts and legal ownership, but they solve different commercial problems and should not be collapsed into one undifferentiated software asset without a formal valuation reason.

## 8. Evidence suitable for valuation review

The following evidence classes are available:

1. **Source-code evidence**
   - TypeScript / React / Next.js / Vite code;
   - server functions;
   - API routes;
   - Android source;
   - SQL migrations.

2. **Architecture evidence**
   - product architecture;
   - role models;
   - state machines;
   - payment / finance boundaries;
   - marketplace and logistics workflow blueprints.

3. **Testing evidence**
   - unit tests;
   - integration tests;
   - contract tests;
   - E2E suites;
   - production build evidence.

4. **Development-history evidence**
   - Git commits;
   - pull requests;
   - merge history;
   - checkpoints;
   - defect closure records.

5. **Brand / product evidence**
   - domains;
   - logos;
   - application assets;
   - marketplace presentation;
   - Android assets.

6. **Operational evidence**
   - production configuration;
   - deployment files;
   - database schema;
   - security / compliance controls;
   - payment integration architecture.

## 9. What is not yet proven by GitHub alone

GitHub evidence does not by itself prove:

- the monetary value of the software;
- that every historical development cost qualifies for accounting capitalisation;
- that every contributor assigned all IP rights to XDrive Logistics Ltd;
- ownership of every third-party image, font, SDK or external asset;
- trademark registration;
- domain ownership;
- cloud-account ownership;
- historic cash cost of development.

These items require accounting, contract, invoice, domain, trademark and third-party licence evidence.

## 10. IP governance risks identified

### Public repository visibility

The primary XDrive and Loadify repositories are currently **public**.

This does not remove copyright or legal ownership, but it materially affects any claim that the already-published source code is a confidential trade secret.

Recommended governance action:

- review whether the primary source repositories should be private;
- before changing visibility, confirm Netlify, Supabase, CI/CD and deployment integrations will remain intact;
- preserve immutable evidence snapshots / commit SHAs;
- maintain restricted access and contributor records after any change.

### GitHub namespace

`XDriveLogisticsLtd` remains the technical account name.

Repository documentation now explicitly records that the legal entity is XDrive Logistics Ltd. A future administrative namespace transfer/rename may improve consistency, but it should be executed only with a full integration-impact plan.

### Repository metadata

Repository-level GitHub descriptions/homepage fields are currently not populated on the primary repositories. The connected GitHub tool does not expose safe repository-settings mutation. These should later be set administratively to identify XDrive Logistics Ltd and the relevant platform websites.

## 11. Accounting / valuation preparation

For a professional valuation, the next evidence layer should include:

- historic developer / contractor invoices;
- salary or founder-time evidence where reliably measurable;
- hosting / Supabase / Netlify / Stripe / domain / tooling invoices;
- software design and development contracts;
- IP assignment clauses;
- brand / trademark records;
- domain ownership;
- commercial traction evidence;
- replacement-cost estimate;
- economic-income / cash-flow assumptions;
- remaining useful life and obsolescence risks.

Three valuation lenses may then be considered by a qualified professional:

- **cost approach / replacement cost**;
- **income approach**;
- **market-comparable approach**.

No single approach should be selected in this pack without independent professional analysis.

## 12. Funding interpretation

The strongest defensible statement supported by this pack is:

> XDrive Logistics Ltd is not seeking support for an unbuilt idea. The company has already developed substantial, identifiable and auditable software platforms, database architecture, workflows, APIs, testing infrastructure and product documentation. The Git history and current production-oriented repositories provide evidence of prior technology investment and execution risk already borne by the company/founder.

This statement does **not** imply that a lender or grant scheme must accept the software as a cash-equivalent contribution. That is scheme-specific and must be separately confirmed.

## 13. Evidence integrity rule

For all future funding documents:

- do not assign an invented software value;
- do not count duplicate/legacy repositories as separate assets without overlap analysis;
- distinguish current code from historical/deprecated code;
- distinguish implemented architecture from future roadmap;
- distinguish technical evidence from legal/accounting conclusions;
- retain exact repository SHAs and evidence dates.

---

**Status:** Technology & IP Asset Pack v1 — evidence foundation established.  
**Next layer:** formal chain-of-title evidence + development-cost reconstruction + independent/accounting valuation readiness.
