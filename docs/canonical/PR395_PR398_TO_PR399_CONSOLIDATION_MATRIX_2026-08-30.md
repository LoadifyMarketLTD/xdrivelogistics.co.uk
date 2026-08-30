# PR #395 / #398 -> PR #399 consolidation matrix

Date: 2026-08-30
Canonical target: PR #399 (`fix/cx-dashboard-convergence-20260829`)
Source PRs: #395 (`feat/cx-parity-complete-20260828`), #398 (`audit/cx-vs-xdrive-e2e-20260828`)

## Rules

- `ALREADY IN 399`: equivalent or stronger current contract exists in PR #399.
- `PORTED TO 399`: source contained a useful missing contract and it has been selectively moved into PR #399.
- `OBSOLETE / SUPERSEDED`: a newer canonical implementation exists or production makes the old implementation unnecessary.
- `DO NOT PORT`: conflicts with the current architecture/security boundary, creates dead schema, or represents an incomplete foundation that must not be exposed as a finished feature.
- Never merge #395 or #398 wholesale. Their branches diverged from #399 and contain stale/overlapping implementations.
- `apps/driver-mobile` Expo/React Native is the canonical Driver application. `android-native` Kotlin is not a source application to resurrect.

## PR #398 -> #399 — final disposition

| Capability | Final verdict | Evidence / reason |
|---|---|---|
| Strict Exchange visibility | PORTED TO 399 | Missing visibility no longer defaults to public Exchange. |
| Exchange expiry on Driver Marketplace | PORTED TO 399 | Expiry is enforced across Driver Marketplace, Driver search and Company Marketplace quote entry points. |
| Active quote identity at carrier-company level | PORTED TO 399 | Company-bound drivers now share the one-active-company-quote boundary; colleague amounts/messages remain private. |
| Pre-award coordinate privacy | ALREADY IN 399 | Public Marketplace DTOs expose broad route areas/outcodes, not exact coordinates/addresses. |
| Canonical atomic Return Journey replacement | PORTED TO 399 | Hosted server-only RPC `replace_driver_return_journey_canonical`; migration `20260830004421_port_driver_return_journey_canonical_atomic_replace`. |
| `pod-photos` PDF MIME migration | OBSOLETE / NO HOSTED CHANGE | Production bucket already permits PDF because `allowed_mime_types` is NULL. |
| First-class POD damage evidence | PORTED TO 399 | Hosted nullable `jobs.damage_photos`; migration `20260830004958_port_driver_pod_damage_evidence`. |
| Server-mediated binary POD/collection upload | PORTED TO 399 | Expo evidence now goes through authenticated device-bound `/evidence` API rather than direct Storage mutation. |
| Tenant/category evidence paths | PORTED TO 399 | Evidence paths are company/job/category scoped while preserving existing storage tenant policy. |
| Do not link delivery evidence until final POD | PORTED TO 399 | Delivery/damage/document evidence is staged and linked only through final verified POD flow. |
| Durable offline POD evidence | PORTED TO 399 | Picker/cache files are persisted before queue storage. |
| Durable offline collection evidence | PORTED TO 399 | Collection evidence is persisted for queued Loaded transitions. |
| Offline permanent-4xx retry classification | PORTED TO 399 | Permanent client errors are not silently replayed forever. |
| Server-authoritative physical evidence during lifecycle transitions | PORTED TO 399 | Lifecycle transitions no longer trust client-supplied physical evidence as authority. |
| Multi-drop stop progression / finalization | ALREADY IN 399, NEWER | #399 retains ordered `job_stops`, current-stop guards and final POD/delivery all-stops gate. |
| Device-bound mobile auth/session | PORTED TO 399 | Expo client now sends installation identity consistently; explicit sign-out revokes server binding before local auth cleanup on best effort. |
| Live Loads / quote request device binding | PORTED TO 399 | Live-load and bid calls now use the shared device-bound API client instead of raw fetch/Supabase reads. |
| Company-level active quote suppression in Expo | PORTED TO 399 | Mobile API exposes only active job IDs for the carrier company, without exposing colleagues' commercial quote data. |
| Availability/tracking tenant isolation | PORTED TO 399 | Active-job tracking honours awarded/assigned carrier-company boundary; Fleet availability keeps privacy-safe presence semantics. |
| Fleet availability presence | ALREADY / CONSOLIDATED IN 399 | Current #399 Availability/Drivers/Vehicles surfaces are newer and preserve the server-safe presence contract. |
| Driver resources partial-failure tolerance | PORTED TO 399 | Identity/auth remains fail-closed while peripheral document/invoice/notification failures return partial resources rather than false access denial. |
| Notification feed compatibility | PORTED TO 399 | Expo alerts combine operational `notification_events` with user inbox instructions while retaining compatibility fields. |
| Signed POD and job attachments in list/detail/history | PORTED TO 399 | Signed temporary URLs and audit/operational presentation are available while real Multi-drop stops remain authoritative. |
| Old Android-native runtime/tests | DO NOT PORT | Kotlin app path is non-canonical; only independently justified server/security concepts were retained. |
| Supabase `.temp` metadata | DO NOT PORT | Local CLI metadata is not application source and must not be merged. |

**PR #398 final verdict: SUPERSEDED BY #399 — CLOSE, DO NOT MERGE.**

## PR #395 -> #399 — final disposition

| Capability | Final verdict | Evidence / reason |
|---|---|---|
| Structured rich quote: base amount | PORTED TO 399 | Hosted structured quote metadata preserves total amount semantics while storing base separately. |
| Quote collect-within minutes | PORTED TO 399 | Expo/API/schema accept optional collect-within metadata with server validation. |
| Explicit quoted extras | PORTED TO 399 | Extras are stored structurally instead of relying only on free text. |
| Quoted vehicle identity / immutable vehicle snapshot | PORTED TO 399 | #399 uses the canonical server-validated eligible vehicle and snapshots vehicle details into the quote contract; no arbitrary client vehicle trust. |
| Rich quote production schema | PORTED TO 399 | Hosted migration `20260830011635_port_driver_rich_quote_structure`. |
| Offline rich-quote replay in `android-native` | DO NOT PORT | Native-Kotlin queue is non-canonical. Delayed marketplace bids are also time-sensitive; the canonical Expo path remains server-authoritative and revalidates availability at submission time. |
| `replace_driver_return_journey_v2` | OBSOLETE / SUPERSEDED | Current canonical postcode/time RPC matches production and is already hosted atomically. A second competing journey RPC is not introduced. |
| Rich Going Home / Going To / Future Journey v2 columns | DO NOT PORT AS PARALLEL MODEL | #395 mixes a second journey model (`journey_mode`, capacity fields, history semantics) into the same table without a completed canonical Expo workflow. Current Return Journey + ReturnIQ remain the authoritative flow; a future multi-mode journey product should be designed separately, not hidden inside this convergence PR. |
| `driver_alert_preferences` table | DO NOT PORT AS DEAD FOUNDATION | #395 creates a global preference table but does not provide a complete canonical Expo/provider workflow. #399 already has real Driver Smart Load Alert preferences and operational notification contracts. |
| `driver_search_filter_defaults` table | DO NOT PORT AS DEAD FOUNDATION | #395 creates storage without a complete canonical API/UI lifecycle. Current search/job preferences remain authoritative; persistent filter defaults can be a separate product change if required. |
| Who's Nearby / privacy-safe market intelligence | ALREADY / NEWER IN 399 | Nearby/availability/Radar contracts in #399 preserve privacy and are more integrated with current workspaces. |
| Structured POD confirmation | SUPERSEDED BY PORTED #398 CONTRACT | The later #398 Expo evidence model was selectively ported and coexists with #399 Multi-drop. |
| Timestamped lifecycle history | ALREADY / STRENGTHENED IN 399 | Event Log, job audit trail, POD history and append-only Driver instructions provide the current history contract. |
| XDrive Collection Pass foundation | DO NOT PORT AS INCOMPLETE SECURITY FEATURE | #395 can issue/display a pass but does not provide a complete canonical verifier/site workflow. Exposing a code without end-to-end verification would create fake security parity. Build separately only with issuer + verifier + expiry/revocation + audit + operational UX. |
| Payment terms / security hardening migrations carried on #395 | ALREADY IN CURRENT 399 BASE/HISTORY | The canonical payment-term migration and server-trigger/security migrations already exist on the current branch; no duplicate port is needed. |
| All `android-native/**/*.kt` feature UI/runtime | DO NOT PORT | Conflicts with canonical Expo/React Native application architecture. |

**PR #395 final verdict: SUPERSEDED BY #399 — CLOSE, DO NOT MERGE.**

## Production facts verified during consolidation

- Production project: `jqxlauexhkonixtjvljw` (`xdrivelogistics`).
- `replace_driver_return_journey_canonical` is hosted and server-only through `20260830004421_port_driver_return_journey_canonical_atomic_replace`.
- `jobs.damage_photos` is hosted through `20260830004958_port_driver_pod_damage_evidence`.
- Rich quote structure is hosted through `20260830011635_port_driver_rich_quote_structure`.
- Production `pod-photos.allowed_mime_types` is NULL, therefore the old PDF MIME migration is unnecessary.
- PR #399 preserves the real production Multi-drop route already observed with four ordered `job_stops`.

## Validation / CI truth

- GitHub Actions is currently unavailable because the account/repository has no Actions credits. Observed jobs terminate before runner startup with `steps: []`, `runner_id: 0`, empty runner name. These are `NOT EXECUTED — BILLING/CREDITS UNAVAILABLE`, not application-test failures.
- GitHub Actions is therefore not used as a factual release gate for this consolidation while credits remain unavailable.
- Canonical Netlify `netlify/xdrivelogistics/deploy-preview` is the executable web build/typecheck gate.
- Supabase production schema/migration truth, static contract review and observed authenticated runtime evidence remain separate gates; no unobserved runtime scenario is relabelled PASS.

## Merge disposition

- PR #395: CLOSE as superseded; DO NOT MERGE.
- PR #398: CLOSE as superseded; DO NOT MERGE.
- PR #399: only canonical merge candidate.
- Closing #395/#398 does not imply every future CX-inspired idea is implemented; it means their safe, relevant changes are either absorbed into #399, superseded by newer #399 contracts, or deliberately rejected as stale/incomplete/non-canonical foundations.
- PR #399 must still satisfy the final release gate appropriate to the current environment before merge. GitHub Actions cannot be required while credits are unavailable, but untested runtime features must remain explicitly labelled unproven rather than falsely PASS.
