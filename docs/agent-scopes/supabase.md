# Agent Scope: SUPABASE

> Product: Supabase schema, migrations, RLS policies, edge functions, tests  
> Scope class: `SUPABASE`

---

## Allowed paths

| Path | Notes |
|---|---|
| `supabase/migrations/**` | Ordered migration files |
| `supabase/tests/**` | pgTAP / Supabase test files |
| `supabase/functions/**` | Edge Functions |
| `supabase/config.toml` | Supabase project config |
| `database/**` | Consolidated schema reference |
| `.github/workflows/validate-supabase-*.yml` | Supabase-specific CI validation |
| `.github/workflows/validate-atomic-company-registration.yml` | Contract validation |
| `.github/workflows/validate-commercial-agreement-invoice-flow.yml` | Contract validation |
| `.github/workflows/validate-confirmed-account-reconciliation.yml` | Contract validation |
| `.github/workflows/validate-identity-compliance-foundation.yml` | Contract validation |
| `.github/workflows/validate-invoice-delivery-tracking.yml` | Contract validation |
| `.github/workflows/validate-invoice-snapshot-integrity.yml` | Contract validation |
| `.github/workflows/validate-job-creation-idempotency.yml` | Contract validation |
| `.github/workflows/validate-notification-recipient-isolation.yml` | Contract validation |
| `.github/workflows/validate-notification-secret-scrub.yml` | Contract validation |

## Conditionally allowed (with documented justification)

| Path | Condition |
|---|---|
| `lib/server/**` (narrowly) | Only when a new server API route is strictly required by a new Supabase schema change; must not redesign existing web features |
| `app/api/**` (narrowly) | Only for new API endpoints matching a new migration schema |

## Forbidden (do not modify without Platform Owner approval)

- Dashboard redesign or web UI work
- `app/**` UI pages unrelated to a migration
- `apps/driver-mobile/**` — Expo scope
- `android-native/**` — Android scope
- Root `package.json`, `package-lock.json` (unless `supabase` CLI is being pinned)
- **Production migration execution** — migrations must only be applied via the Supabase dashboard or approved CI pipeline, never by an agent
- **Production data operations** — no `INSERT`, `UPDATE`, or `DELETE` on live data

## Migration rules

1. Migration files must be sequentially numbered (next available number).
2. Each migration must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … IF NOT EXISTS`).
3. Never modify or delete an existing migration file that has been applied to production.
4. Every RLS policy must be tested with a corresponding `supabase/tests/` file.
5. New tables must have `ENABLE ROW LEVEL SECURITY` in the same migration.

## Required checks before merging

1. Migration sequence is gap-free (`npm run audit:auto:fast` DB-01 checks).
2. New RLS policies verified against `SEC-01` checks.
3. `validate-supabase-migration-files.yml` CI passes.
4. Schema reference in `database/` updated if tables/columns changed.

## Production safety declaration (required)

```
PRODUCTION SAFETY:
  This migration was NOT executed against production.
  Execution method: <Supabase dashboard / approved CI pipeline>
  Rollback plan: <describe or reference migration file>
  Data impact: <none|describe>
```

## Agent preflight declaration (required)

See `docs/agent-scopes/agent-preflight.md`.
