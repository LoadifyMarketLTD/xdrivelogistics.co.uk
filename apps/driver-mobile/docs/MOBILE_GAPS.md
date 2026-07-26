# XDrive Driver Mobile — Native Gap Matrix

Audit baseline:
- Branch: `copilot/transform-mobile-workspace-driver`
- Commit: `27401185a045e2e014c943dfad1fb24491d7689b`
- Scope: Native app under `apps/driver-mobile` vs required operational parity.

## Native-vs-web and required-feature gaps

| Gap ID | Feature | Current native state | Severity | Required API | Required screen/workflow | Required validation | Blocks APK release |
|---|---|---|---|---|---|---|---|
| MG-001 | Canonical lifecycle parity (`posted→...→delivered`) | Native aliases/collapses canonical states | P0 | `POST /api/driver/mobile/jobs/:id/:action` + lifecycle mapping helpers | Active Job + state engine | Full transition matrix with idempotency and invalid-transition tests | Yes |
| MG-002 | Queue isolation per account | Global offline queue key shared across users | P0 | Queue persistence model (`AsyncStorage`) + sync worker | Offline queue subsystem | Multi-account switch with pending queue persistence tests | Yes |
| MG-003 | Build pipeline correctness | `eas.json` schema invalid (`production.android.splits`) | P0 | EAS config | Build configuration | `npx eas-cli config`, preview build smoke test | Yes |
| MG-004 | Offline quote submission | No offline quote queue/retry/idempotency | P1 | `POST /api/driver/mobile/bids` + client queue integration | Live Loads quote flow | Offline/online replay tests, duplicate suppression | Yes (operational continuity) |
| MG-005 | Notification deep-link lifecycle | Token registration/list shell only; no tap routing | P1 | Notification payload contract + job fetch endpoint | Notifications + app entry routing | Foreground/background/cold-start deep-link tests | Yes |
| MG-006 | Multi-active job handling | First-item assumption for active job state | P1 | Jobs listing endpoint + selection rules | Active Job / My Jobs | Multiple allocated jobs conflict tests | Yes |
| MG-007 | Job detail operational completeness | Missing quantity/weight/dimensions/map/call/waiting-time fields | P1 | `GET /api/driver/mobile/jobs/:id` (add fields if absent) | Job Detail | Field completeness + authorization masking tests | Yes |
| MG-008 | POD idempotent re-submit protection | Repeated submissions can append duplicate evidence | P1 | `POST /api/driver/mobile/jobs/:id/pod` | POD | Duplicate submission/idempotency contract tests | Yes |
| MG-009 | Driver availability management | Not implemented in native | P2 | New `/api/driver/mobile/availability` | Profile/Availability screen | CRUD + schedule conflict validation | No |
| MG-010 | Driver messages | Not implemented in native | P2 | New `/api/driver/mobile/messages` | Messages screen | Send/receive/read-state tests | No |
| MG-011 | Finance detail workflows | Native shows invoice counts only | P2 | `/api/driver/finance/invoices*` | Finance screen(s) | Amount parity, status transitions, doc access tests | No |
| MG-012 | Password change flow | Not implemented in current native UI | P2 | `/api/driver/password` | Profile > Security | Validation + re-auth and token continuity tests | No |

## Release-gate summary

### Must close before APK release (P0/P1 release blockers)
- MG-001, MG-002, MG-003, MG-004, MG-005, MG-006, MG-007, MG-008

### Can be scheduled post-initial release (P2)
- MG-009, MG-010, MG-011, MG-012

## Evidence references
- `apps/driver-mobile/src/app/DriverMobileApp.tsx`
- `apps/driver-mobile/src/jobs/statusFlow.ts`
- `apps/driver-mobile/src/offline/queue.ts`
- `apps/driver-mobile/src/live-loads/LiveLoadsScreen.tsx`
- `app/api/driver/mobile/_lib.ts`
- `app/api/driver/mobile/jobs/[id]/[action]/route.ts`
- `apps/driver-mobile/eas.json`

