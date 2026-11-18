# AUTHORITATIVE INSTRUCTIONS — 2026-10-27

Source: user-uploaded `XDRIVE_DRIVER_PWA_BLUEPRINT_UNIC_COMPLET_2026-10-26_1530.docx`, 42 pages, including V2.0, V2.1, measured contract and mandatory protocol. This document is authoritative for product details, but explicit subsequent user instructions override conflicting older directions.

## Current user overrides
- Build a BRAND-NEW Driver PWA implementation, not a cosmetic modification of the existing PWA. Keep existing repository backend/auth as verified reusable infrastructure; do not modify old PWA UI. The blueprint's 'do not create separate app' means no independent demo or unrelated product, not permission to overwrite old UI.
- Implement and fully verify LOADS / Jobs + Details + Quote Now FIRST. Do not implement Quotes, Bookings, More until LOADS has been validated and user agrees on visual result.
- No OPPO/physical-device tests at this stage. Desktop local checks only.
- Autonomous inspect -> implement -> test -> fix -> retest on EACH section, not only at end; no routine interim reports.
- Do not delete existing PWA files or deploy/merge/push without a safe verified plan and applicable authorization. Existing worktree with uncommitted changes is protected.

## Required sources and precedence
1. Latest explicit user instructions.
2. Master Blueprint DOCX 2026-10-26 15:30, all 42 pages; V2.1 complements V2.0.
3. Original CX screenshots (including 55020.png and 20391.png), JSON measurement files and HTML dossier; validate SHA, viewport and DPR.
4. Actual XDrive code: APIs, auth, permissions, brand assets.
5. Proposed implementation values clearly marked PROPOSED/UNMEASURED.

## Required LOADS behavior
Company/posted time, HOTSHOT/service, vehicle/body, pickup and delivery Town+Outcode, At/By/Between/ASAP times, notes, cargo, payment terms, status; Quote Now and View Details only on card. Filters Body Type, pickup radius AND destination radius, collect within 15/30/45/60/90/120; no expired/allocated/sold jobs. Details include load ID, map only on detail with no blank failure container, cargo/dimensions/packaging, payment, authorized contacts and quote validation/no double submit. Only real backend fields; no invented values.

## Visual and QA gates
Raster measurements are NOT CSS pixels: 709x106 header, 709x204 summary, 709x245 route, 709x121 notes, 675x85 CTA, 709x103 bottom nav. Calibrate viewport/DPR and inspect getBoundingClientRect/computedStyle and authenticated screenshots for each section. Light XDrive identity, not CX yellow branding. 44x44 CSS px minimum touch. Document measurement ID, screenshot, coordinate system, component, selector, test, tolerance and status; unverified != PASS. Use PowerShell, ESLint, TypeScript, unit, Playwright, build; no GitHub Actions.

## Current technical state
Worktree `D:\XDrive-Driver-PWA-Fresh-20261026` branch `feat/driver-pwa-fresh-loads-20261026`, original repo untouched. New isolated `/driver-pwa-fresh/jobs` and `/driver-pwa-fresh/jobs/[id]` are IN PROGRESS, not visually validated. Latest focused ESLint PASS; global typecheck FAIL due to four unrelated missing imports. No commit, merge, push or deployment. Continue from AUTONOMOUS_EXECUTION_CHECKPOINT.md. Reconcile path to canonical `/m/driver/jobs` at integration time without overwriting legacy code prematurely.
