# XDrive 7 White Workspaces — Loads / Quotes / Diary Audit
Date: 2026-10-17

## Scope
Seven white operational workspaces were verified. Super Admin is excluded.

Roles audited:
1. Customer
2. Broker
3. Operations / Dispatcher
4. Fleet Manager
5. Owner Driver
6. Carrier Admin / Company Admin
7. Company Driver

Final visual authority remains Courier Exchange LIVE. During this audit the Opera Browser Connector was unavailable, so no new CX-live capture was produced. Existing approved CX reference material remains the design authority.

## Repository state
- Repository: D:\XDrive-CX-Debug
- Branch: preview/loads-cx-parity
- HEAD: 916c008
- origin/main: 916c008
- Nothing staged at audit completion.
- Audit/test/fixture files remain local and uncommitted.

## Corrected E2E methodology
The earlier audit was too permissive because authenticated redirects could be counted as a pass and screenshots could be captured while pages were still loading.

The audit was hardened to:
- wait for React hydration before login;
- validate successful authentication;
- require allowed routes to remain on the exact requested path;
- explicitly validate role-denied routes as denied-by-design;
- wait for Loading / Refreshing / Searching states to clear before screenshots;
- measure global shell geometry;
- measure shared card geometry and vehicle presentation;
- keep local and main evidence in separate folders.

Evidence:
- Local: D:\XDrive-CX-Debug\_audit\workspace-unification\runs\20261017-lqd-local
- Main live: D:\XDrive-CX-Debug\_audit\workspace-unification\runs\20261017-lqd-main

## E2E results
### Local
- 7 / 7 role tests passed.
- Runtime: about 3.2 minutes.
- Records: 21.
- Shell geometry deviations: 0.
- Loads-card geometry deviations: 0.
- Vehicle presentation deviations: 0.
- Rights-based denied routes: 4.

### Main live
- 7 / 7 role tests passed.
- Runtime: about 2.7 minutes.
- Records: 21.
- Shell geometry deviations: 0.
- Loads-card geometry deviations: 0.
- Vehicle presentation deviations: 0.
- Rights-based denied routes: 4.

## Global Admin shell verification
For every allowed audited route:
- header: 1680 x 50 px;
- primary navbar: 1680 x 42 px;
- navbar top: 50 px;
- shell font: 12 px;
- normal content begins at y=92 px.

Company Driver content begins lower only because the mandatory compliance / onboarding restriction banner is rendered between the nav and page content. The shell above it remains the same 50 px + 42 px structure. This is intentional and must not be removed.

Conclusion: the Admin shell geometry is global across the white workspaces.

## Loads card verification
Where role rights and runtime data render load cards:
- card height: 134 px;
- font: 12 px;
- border: 1 px solid;
- vehicle image: 46 x 20 px;
- object-fit: contain;
- same three-column card anatomy and footer pattern.

Measured examples include Customer, Broker, Owner Driver, Carrier Admin / Company Admin and Company Driver.

Role-specific filters and actions remain role-specific by design.

## Diary / van verification
Diary was not redesigned.

The professional van presentation from Loads is present in Diary where diary cards are rendered:
- vehicle image: 46 x 20 px;
- object-fit: contain;
- same vehicle-image family and presentation.

Customer and Broker diary cards use the common card geometry. Owner Driver Diary is taller because it legitimately exposes additional role-specific actions such as POD, documents, invoice and operational controls. Those actions are intentionally preserved.

## Quotes
The shared shell and Quotes page structure were verified on all roles that are allowed to access Quotes. Several accounts currently have empty quote registers, so current live data does not provide a populated quote card in every role. This audit therefore does not claim populated-card visual identity where runtime data is absent.

## Rights-based routes
Operations / Dispatcher and Fleet Manager do not have marketplace-view / commercial-quote-submit capabilities in the current role model.

Therefore these routes are intentionally denied:
- Operations / Dispatcher: /admin/marketplace and /admin/exchange
- Fleet Manager: /admin/marketplace and /admin/exchange

The hardened audit verifies those redirects as denied-as-designed rather than reporting a false page PASS. Their Diary route remains allowed and was verified.

Do not broaden these permissions merely to make the workspaces visually identical.

## Authentication blocker remediation
Local E2E authentication was repaired before the final audit:
- stale Next .next assets causing static 404 / MIME issues were removed;
- the dev server was restarted cleanly;
- required public Supabase local configuration was restored;
- required server-side service-role configuration was restored from the authorised Desktop E2E environment without exposing values;
- E2E waits for React hydration before submitting login;
- temporary env-rewrite instrumentation that forced Next env reloads during login was removed.

## Final verified statement
Admin shell is globally unified across the seven white operational roles.

Shared Loads card geometry and van presentation are verified where the role is authorised and cards are actually rendered.

Diary retains role-specific actions and has not been redesigned; only the approved vehicle presentation is shared.

Role-specific functions, filters, actions and access rights are preserved.

This report does NOT claim that every role owns every page, nor that all role-specific page controls are identical.


## Final pre-push gate
Immediately before push:
- Main live E2E: 7/7 role tests passed.
- Local E2E: 7/7 role tests passed.
- Visual identity / renderer / shell contracts: 45/45 tests passed across 7 files.
- Production build: exit code 0.
- Role-specific CSS override scan: no role-specific override targets any of CxLoadCard, CxQuoteCard or CxDiaryCard.
- Populated Quotes fixture computed-style parity was measured under Admin, Customer, Broker and Driver wrappers:
  - card: 1483 x 131 px;
  - main: 104 px;
  - footer: 25 px;
  - card font: 12 px;
  - identical 3-column grid;
  - vehicle image: 46 x 20 px, object-fit contain.
- Loads populated runtime cards showed 134 px card height, 12 px font and 46 x 20 px vehicle image where role rights and data permit cards.
- Admin global shell measured identically across allowed routes: 50 px header + 42 px nav.
