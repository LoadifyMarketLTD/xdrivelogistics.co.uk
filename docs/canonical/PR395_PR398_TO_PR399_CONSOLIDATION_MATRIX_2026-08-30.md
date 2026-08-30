# PR #395 / #398 -> PR #399 consolidation matrix

Date: 2026-08-30
Canonical target: PR #399 (`fix/cx-dashboard-convergence-20260829`)
Source PRs: #395 (`feat/cx-parity-complete-20260828`), #398 (`audit/cx-vs-xdrive-e2e-20260828`)

## Rules

- `ALREADY IN 399`: equivalent or stronger current contract exists in PR #399.
- `PORTED TO 399`: source contained a useful missing contract and it has been selectively moved into PR #399.
- `PORT TO 399`: useful source contract remains missing or weaker in PR #399.
- `OBSOLETE / SUPERSEDED`: a newer canonical implementation exists or production makes the old migration unnecessary.
- `DO NOT PORT`: conflicts with the current architecture/security boundary.
- Never merge #395 or #398 wholesale. Their branches diverged from #399 and contain stale/overlapping implementations.
- `apps/driver-mobile` Expo/React Native is the canonical Driver application. `android-native` Kotlin is not a source application to resurrect.

## PR #398 -> #399

| Capability | Verdict | Evidence / reason | Action |
|---|---|---|---|
| Strict Exchange visibility | PORTED TO 399 | #399 previously treated missing `exchange_visibility` as public Exchange. | Ported fail-closed visibility guard in `2589cab3`. |
| Exchange expiry on Driver Marketplace | PORTED TO 399 | #399 previously returned expired Exchange posts. | Ported `exchange_expires_at` gate in `2589cab3`. |
| Active quote identity at carrier-company level | PORTED TO 399 | #399 web Marketplace previously queried `myBid` only by `bidder_user_id`. | Ported company-first bid projection in `2589cab3`; preserved #399 `requireWebDriver`. |
| Pre-award coordinate privacy | ALREADY IN 399 | Current Marketplace projection exposes broad route areas, not exact coordinates. | Contract test retained in `dc259976`. |
| Canonical atomic Return Journey replacement | PORTED TO 399 | #399 API used delete-before-insert. | Production RPC hosted as `20260830004421`; repo migration `6e1e63d1`; API port `3822f803`; test `26286d53`. |
| `pod-photos` PDF MIME migration | OBSOLETE / NO HOSTED CHANGE | Production bucket has `allowed_mime_types = NULL`, so PDF is already permitted. | Do not create a no-op production migration. |
| First-class POD damage evidence | PORT TO 399 | Production currently lacks `jobs.damage_photos`; #398 keeps damage separate from delivery photos. | Add nullable JSONB field and preserve category end-to-end. |
| Server-mediated binary POD/collection upload | PORT TO 399 | #399 Expo client still uploads directly to Supabase storage. | Move Expo evidence through authenticated device-bound `/evidence` API. |
| Tenant/category evidence paths | PORT TO 399 | #398 uses `company/job/category/object`; #399 evidence path is less structured. | Port while preserving existing storage tenant boundary. |
| Do not link delivery evidence until final POD | PORT TO 399 | #399 `/evidence` immediately mutates POD arrays. | Port staged upload + final verified POD linking. |
| Durable offline POD evidence | PORT TO 399 | #399 queue can retain picker/cache URIs that may disappear after restart. | Port `podEvidencePersistence.ts`. |
| Durable offline collection evidence | PORT TO 399 | #399 queued Loaded transition has no durable collection-photo payload. | Port `collectionEvidencePersistence.ts`. |
| Offline permanent-4xx retry classification | PORT TO 399 | #399 failed queue entries can remain automatic regardless of permanent client error. | Port manual-vs-automatic retry mode. |
| Server-authoritative physical evidence during lifecycle transitions | PORT TO 399 | #399 lifecycle still accepts evidence values in status body. | Port NULL physical-evidence RPC parameters while preserving Multi-drop gates. |
| Multi-drop stop progression / finalization | ALREADY IN 399, NEWER | #399 has ordered persisted stops and POD/delivered all-stops gate not present in #398 baseline. | Preserve #399 implementation during POD merge. |
| Device-bound mobile auth/session | REVIEW NEXT | #398 contains additional session/logout hardening. | Compare against current #399 before any port. |
| Availability/tracking lifecycle | REVIEW NEXT | #398 contains several tenant/active-job corrections. | Compare current #399 server + Expo contracts. |

## PR #395 -> #399

| Capability | Verdict | Evidence / reason | Action |
|---|---|---|---|
| Structured rich quote: base amount | PORT TO 399 | #399 quote contract currently stores only total amount + free-text message. | Design new production-safe migration/API/UI. |
| Quote collect-within minutes | PORT TO 399 | Missing from current #399 quote form/API/schema. | Port semantics, not old native UI. |
| Explicit quoted extras | PORT TO 399 | Missing as structured field in #399. | Port semantics with deterministic total/idempotency. |
| Quoted vehicle identity + immutable label | PORT TO 399 | Missing from #399; #395 validates assigned Driver/vehicle ownership. | Port server validation and Expo/web presentation. |
| Offline rich quote replay in `android-native` | DO NOT PORT implementation | Kotlin app is not canonical. | Reimplement any needed replay semantics in Expo only. |
| `replace_driver_return_journey_v2` | OBSOLETE / SUPERSEDED | #398 canonical atomic RPC matches current production schema and is now hosted/ported. | Do not add v2 RPC. |
| Rich Going Home / Going To / Future Journey schema | REVIEW / PORT SELECTIVELY | Current XDrive Return Journeys already has a richer web workflow and canonical postcode/time fields; #395 migration mixes another model. | Audit semantic gaps before schema mutation. |
| `driver_alert_preferences` | LIKELY SUPERSEDED, VERIFY | #399 has Driver Smart Load Alert preferences and notification contracts. | Compare field semantics before closing. |
| `driver_search_filter_defaults` | REVIEW | #399 has job search preferences and some local defaults, but not necessarily identical server persistence. | Decide after Driver search audit. |
| Who's Nearby / privacy-safe market intelligence | ALREADY/PARTIAL, VERIFY | #399 has Nearby/availability/Radar work with privacy boundaries. | Compare remaining PPM/aggregation semantics only. |
| Structured POD confirmation | SUPERSEDED BY #398 | #398 contains later Expo-focused evidence reconciliation. | Port #398 version, not #395 version. |
| Timestamped lifecycle history | ALREADY/PARTIAL, VERIFY | #399 has Event Log/history projections. | Confirm Driver detail parity before closing. |
| XDrive Collection Pass | PORT TO 399 | No production `driver_collection_passes` table observed and no canonical Expo flow in #399. | Build server-owned + Expo contract after POD/session consolidation. |
| All `android-native/**/*.kt` feature UI/runtime | DO NOT PORT | Conflicts with canonical Expo/React Native app. | Extract concepts only where independently justified. |

## Production facts verified during consolidation

- Production project: `jqxlauexhkonixtjvljw` (`xdrivelogistics`).
- #395 rich-quote columns/tables/RPC are not currently hosted.
- Production `return_journeys` includes legacy compatibility columns and canonical `from_postcode`, `to_postcode`, `available_from`, `available_to`, `vehicle_type`, `notes`, `status` fields.
- Production `pod-photos.allowed_mime_types` is `NULL` (unrestricted); the #398 PDF MIME migration would therefore make no change.
- `replace_driver_return_journey_canonical` is hosted through migration `20260830004421_port_driver_return_journey_canonical_atomic_replace` and is server-only.

## Merge disposition

- PR #399 remains the only canonical merge candidate.
- PR #395 must not be merged wholesale because it contains the superseded native-Kotlin application path and mixed schema contracts.
- PR #398 must not be merged wholesale because it diverged from #399 and would overwrite newer Multi-drop/workspace work; its security/E2E fixes are selectively ported.
- Close #395/#398 as superseded only after every `PORT TO 399` / `REVIEW` row has a factual final verdict and the corresponding #399 gates are validated.
