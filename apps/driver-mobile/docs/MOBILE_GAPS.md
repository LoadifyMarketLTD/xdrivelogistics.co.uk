# XDrive Driver Mobile — Feature Gap Register

This document is the canonical record of features present in the web Driver Workspace
(`/driver`) that are not yet implemented in the native Expo application
(`apps/driver-mobile`). It is maintained as the authoritative pre-implementation
checklist for Phase 4 work.

**Architecture rule**: every gap feature must be implemented by calling an existing
backend API endpoint or adding a new `/api/driver/mobile/*` endpoint that is also
used by the web. Business logic must never be duplicated between web and native.

---

## Auto-Invoice on Delivery — Intentional Asymmetry

**Scope**: The mobile action route (`POST /api/driver/mobile/jobs/:id/delivered`)
calls `autoGenerateMarketplaceInvoice` after a successful delivery status update.
The admin/web transition route (`POST /api/admin/jobs/:id/transition`) does **not**
call this function — invoice generation on the web is a manual step via
`/driver/finance`.

**Decision (recorded 2026-07-26)**: This is intentional for the initial native app
release. The native app triggers automatic invoice generation as a convenience for
owner-drivers operating without a dedicated admin. The web admin flow retains the
manual step so that dispatchers and company admins can review before generating.

**Future alignment**: When the web driver workspace is updated to support
fully-automated invoicing, `autoGenerateMarketplaceInvoice` should be called from a
shared service function rather than from both routes independently.

---

## Gap Register

Priority guide:
- **P0**: Blocks a driver from completing core operations end-to-end.
- **P1**: Required for full driver self-service without falling back to web.
- **P2**: Non-blocking quality/completeness improvement.

| Gap ID | Feature | Web Route | Backend Endpoint Available | Priority | Notes |
|---|---|---|---|---|---|
| MG-001 | Document upload + expiry tracking | `/driver/documents` | `POST /api/driver/mobile/resources` (action=upload_document) | P1 | Backend ready. Native screen needed: list documents from `resources.documents`, upload via existing endpoint. |
| MG-002 | Vehicle information (view) | `/driver/vehicles` | `GET /api/driver/mobile/resources` (`resources.vehicle`) | P1 | Read-only view available from resources endpoint. Vehicle registration/update requires `/api/driver/vehicles`. |
| MG-003 | Finance — Invoice list + detail | `/driver/finance` | `/api/driver/finance/invoices` | P1 | Invoices are already returned in `resources.invoices`. A dedicated mobile endpoint for full detail/PDF access is needed. |
| MG-004 | Finance — Generate invoice for delivered job | `/driver/finance` | `/api/driver/finance/jobs/:id/generate-invoice` | P1 | Manual invoice generation for non-marketplace jobs not yet surfaced in native. |
| MG-005 | Availability calendar | `/driver/availability` | No mobile endpoint yet | P2 | Requires new `/api/driver/mobile/availability` endpoint. |
| MG-006 | Messages | `/driver/messages` | No mobile endpoint yet | P2 | Requires new `/api/driver/mobile/messages` endpoint or reuse of existing messaging infra. |
| MG-007 | Won-work board (accepted quotes) | `/driver/won-work` | Partial via `resources.quotes` | P2 | `resources.quotes` returns bids with status. A filtered view of accepted bids is achievable without a new endpoint. |
| MG-008 | Returns marketplace (post-delivery IQ) | `/driver/returns` | Partial via `/api/driver/mobile/nearby-jobs?mode=destination` | P2 | The Return IQ feed already exists. A dedicated Returns screen in the native nav is missing. |
| MG-009 | Advanced load search with filters | `/driver/loads/search` | Partial via `/api/driver/mobile/nearby-jobs?search=` | P2 | The nearby-jobs endpoint accepts a `search` param. A filter UI (vehicle type, region) is missing in native. |
| MG-010 | Change password | `/driver/change-password` | `/api/driver/password` | P2 | Low risk — Supabase magic link / email reset is available as fallback. |

---

## Implementation Rules for Phase 4

Each gap feature must be delivered in a separate PR. Before opening a PR:

1. Confirm the backend endpoint exists (or create one in `app/api/driver/mobile/`).
2. The endpoint must pass through `requireDriver()` for auth/identity.
3. The native screen must call only the mobile API endpoints — never query Supabase directly (except for auth bootstrapping via `src/auth/supabase.ts`).
4. Add a contract test in `e2e/mobile-api-contract.spec.ts` for the new endpoint.
5. Pass CI (`npm run typecheck && npm run lint && npm run build`) before requesting review.
