# WORKSPACE 3510 — Loads all-workspaces checkpoint (2026-11-08)

Authority: Original localhost:3150 Customer Loads design must be implemented in ALL XDrive Logistics workspaces that have Loads, not just Customer. Earlier declaration of Customer Loads as final for whole Loads workstream is incorrect. No alternate UI models, fake operational data, demo API writes, or changes to PWA 1099. Operational behavior and RBAC must be preserved.

Current origin/main baseline: 067cb6a6 (Customer Loads PR #770 merged and Netlify production confirmed with two authenticated E2E PASS). Isolated worktree: D:\XDrive-3510-Loads-All-Workspaces-20261108; branch fix/3510-loads-all-workspaces-20261108, based on origin/main. Customer Quotes worktree is separate and untouched by this work.

Actual 7 workspace routing for Loads: Customer -> /customer/loads (already original 3150); Broker -> /broker/loads; Company / Carrier, Fleet, Dispatcher -> /admin/marketplace; Owner Driver, Company Driver -> /driver/loads. Original Company/Driver/Broker routes use real APIs and operational functions and already share Master3150Card through CxLoadCard or ApprovedDriverLoadCard. DO NOT replace these with unconnected DemoExchangeBoard API actions.

Local work (NOT DEPLOYED): shared master3150-unified-loads.css (220px filter rail, 18px gap, 174px minimum card height, approved card geometry, responsive 720px); imported and applied to real CompanyMarketplaceExchange, Broker Loads and Driver Loads. Broker gets approved Loads header and service-type tabs from real WorkspaceJob.load_type while keeping its operational stage tabs, quotes/award/edit/POD actions and RLS datasets. Company gets consistent Loads heading; existing quote/map/georadius business logic untouched. Driver retains real quoting and map flows. Customer original is unchanged. Added 7-role contract tests and Playwright read-only authenticated route tests, retaining exact role mappings.

Evidence: first five focused Vitest 5/5 PASS, scoped ESLint PASS before adding Broker type tabs and common heading; rerun scoped ESLint and 5 Vitest PASS after those changes. TypeScript full rerun started in process PID 18624 and must be checked. Full build / browser visual on this new code and authenticated role-by-role E2E are NOT YET DONE. No main merge or Netlify publish on this branch. Do not claim completion.

Next: Verify current TS process, run full build, compare 3150 vs role routes in Opera/Playwright at desktop and mobile, publish preview PR only when static checks PASS, run 7 authenticated role E2E (verify no skipped roles), fix visual/functional differences, merge only tested files to main and verify Netlify production and live Opera. Record any role access failures, especially Fleet/Dispatcher/Company Driver, without substituting other roles.

## Actual execution and findings — 8 November 2026, 13:28 UTC

The initial section above documents the original baseline at creation. Current main baseline is 8577d366 (including approved Customer Loads PR #770 and customer Radius/reset PR #773). The feature branch is PR #771, NOT merged.

Authenticated Chromium Playwright on exact first preview head 733b6c14: 7/7 role routes PASS, zero skipped. This verifies authenticated page routing and shell, not 1:1 visual parity or all operational controls. Mobile Safari 5/7 pass for non-driver workspaces; Driver mobile enters a separate official Driver PWA, intentionally not modified here.

Actual Playwright desktop screenshot inspection after 4 seconds showed three remaining differences: Carrier/Fleet/Dispatcher retained legacy toolbar & mojibake, Owner Driver retained a 5-card KPI strip and old service tabs and 200px cards, Broker showed necessary secondary lifecycle status tabs. Company Driver test user displayed no available loads. No fictitious loads were inserted.

Current corrective local changes:
- Company/Carrier/Fleet/Dispatcher: original Master3150 top tabs All Loads / On Demand / Same Day / Next Day with real collection date/outcode filtering, My Loads real route, primary View Details with existing authorised detail modal; regular/daily hire, quick search, refresh, map and quoting remain available in sub-controls. Removed garbled toolbar/pagination/expand glyphs. Shared approved visual rules and action sizing.
- Owner/Company Driver desktop: relocated Loads heading and approved primary tabs above filter+cards, preserved statistics in collapsible accessible section, retained real advanced service-type selector, real quotes and map and My Loads route, removed redundant posted label and footer identity to compact card while preserving member ID under posted metadata. Added real 5/10/20/30/50/100/200/300 mile radius using the existing public outcode centroid API, with safe loading/unavailable labels, and stored selection alongside saved filters. Did not modify mobile Driver PWA.
- Broker original card and lifecycle semantics remain unchanged.
- Screenshot/read-only browser QA tests added without production writes.

Evidence after first presentation-only patch: scoped ESLint PASS, 15/15 Vitest contracts PASS, TypeScript PASS and full low-memory Next.js build PASS (190 static pages). Driver outcode radius and footer compactness were added after that build and require an additional final TypeScript/build verification and browser comparison. PR #771 must remain DRAFT until final preview screenshot and authorised functional tests PASS. No Netlify production changes on this branch.

Current testing source: D:\XDrive-3510-Loads-All-Workspaces-20261108\e2e\master3150-loads-primary-tabs-readonly.spec.ts, plus master3150-loads-visual-audit-readonly.spec.ts. Browser Connector to Opera still disconnected; Playwright Chromium screenshots are available.
