# Super Admin Command Centre — product and UI decision

Status: accepted audit baseline  
Baseline: `main`  
Scope: `/super-admin` and its navigation shell

## Product position

Super Admin is the platform governance and exception-management workspace. It must answer:

1. Is the platform safe and operational?
2. Which platform-level exception must be handled next?
3. Which company, user, job, document, payment, or service is affected?
4. What is the accountable action and destination?
5. Is the displayed result exact, partial, unavailable, or derived?

It is not a carrier dashboard, a fleet dashboard, or a general analytics landing page.

## Current implementation audit

### What is sound

- The home route already separates platform summary, critical attention, and an action queue.
- The command-centre API explicitly distinguishes partial and unavailable sources.
- The action queue is honestly labelled as derived rather than a persistent incident registry.
- P0/P1/P2 ordering and direct review destinations are appropriate.
- The environment badge and refresh timestamp are essential Super Admin context.

### Defects and contradictions

1. The measurement document is stale. It claims six KPI tiles, a company register, a finance rail, approvals panel, and activity feed; the current route renders four summary KPIs, five attention indicators, one derived queue, and an audit-trail shortcut.
2. The navigation contains too many status-specific destinations as permanent items. Jobs/Active Jobs/Pending Jobs/Completed Jobs and Companies/Pending/Active/Suspended create navigation duplication; statuses belong in module filters and saved views.
3. `Platform Analytics`, `Platform Health`, and the Command Centre overlap unless their contracts are explicit:
   - Command Centre: urgent exceptions and action ownership.
   - Health: services, integrations, latency, failures, degraded dependencies.
   - Analytics: trends, cohorts, throughput, conversion, financial reporting.
4. When the stats endpoint fails, the page can continue to display loading-style KPI placeholders after loading has completed. Unavailable is not the same as loading.
5. Critical-attention data has no explicit unavailable/empty panel state when the command-centre payload is absent.
6. “Degraded services” is currently unknown because health integration is not implemented. It must remain unknown and must not be styled as healthy zero.
7. The stats endpoint is all-or-nothing: one source failure can make the whole summary unavailable, while the command-centre endpoint supports partial source semantics.
8. “Recent administrative activity” is only a link, not activity. The label overstates the available evidence.

## Approved hierarchy

1. Compact header: Platform Command Centre, environment, last refresh, refresh action.
2. Action severity strip: P0, P1, P2, unavailable sources.
3. Platform exception queue: severity, domain, action, affected entity, age/SLA, owner/state, review action.
4. Compact platform facts: active organisations, pending onboarding, open work, unpaid invoices; each value must expose exact/partial/unavailable state.
5. Service health summary only after a real health source exists.
6. Audit activity only when actual events are returned; otherwise use a plain “Open audit trail” action.

## Navigation decision

Keep stable operational domains in the shell:

- Command
- Organisations
- Operations
- Trust & Compliance
- Finance
- Support
- Platform

Move status variants into each module as filters or saved views. Examples:

- One Jobs destination with Active, Pending, Completed filters.
- One Companies destination with Pending Approval, Active, Suspended filters.
- One Finance destination with Invoices, Payments, Revenue views.
- One Platform destination with Health, Roles, Feature Flags, Audit and Admins.

This is an information-architecture decision; removal of routes requires redirect and permission checks before implementation.

## Data semantics

- Never convert an unavailable count to zero.
- Never describe a derived queue as an incident registry.
- Never display “healthy” for an unimplemented service check.
- Show source availability beside affected metrics.
- Prefer database-side exact counts for platform facts.
- A platform exception must have severity, entity, age/SLA and actionable destination.
- Company and user administrative actions must remain auditable.

## Immediate implementation sequence

1. Preserve the current command-centre API honesty contract.
2. Correct UI loading/unavailable states independently for summary and command-centre data.
3. Expose P0/P1/P2 counts as the primary action strip.
4. Rename or remove the false “Recent administrative activity” presentation until events exist.
5. Add component/API tests for loading, partial, unavailable and derived-queue semantics.
6. Consolidate navigation only after route usage, redirects and permissions are inventoried.
7. Update the stale measurement document after real-route screenshots are captured.

## Non-goals for the first pass

- No production deployment.
- No schema migration.
- No fabricated service health.
- No destructive route deletion.
- No copying Fleet or Carrier dashboard composition.
