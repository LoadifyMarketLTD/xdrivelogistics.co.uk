# Phase 2 Shared UI — Read-only Inventory and Duplication Report

## Scope reviewed

The inventory was performed against the verified Foundation base and the existing authenticated route families:

- `/driver`
- `/customer`
- `/broker`
- `/admin`
- `/admin/fleet`
- `/super-admin`

No production code was changed while producing this report.

## Existing canonical components and contracts

### Shared shell

`app/components/workspace/WorkspaceShell.tsx` is already the canonical shared shell used by Driver, Customer, Broker and Admin layouts. Phase 2 must extend this component rather than create a parallel shell.

### Authentication context

`app/components/AuthContext.tsx` owns the hydrated `ResolvedAuthUser` and route-auth cookie synchronisation. It currently caches an already resolved user and does not expose a forced authoritative refresh after a company/workspace switch.

### Active company resolution

`lib/activeCompany.ts` and `app/components/workspace/useCompanyWorkspaceData.ts` resolve the current company for existing client data loading. Their fallback values are not proof that a requested switch is authorised and must not be used as switching authority.

### Foundation permission contracts

The merged Foundation contracts remain authoritative:

- `lib/activeWorkspace.ts`
- `lib/authActiveCompanyContext.ts`
- `lib/authSession.ts`
- `lib/businessWorkspace.ts`
- `lib/membershipRole.ts`
- `lib/roleCapabilities.ts`
- `lib/workspacePermissionResolver.ts`
- `lib/workspaceRegistry.ts`
- `lib/workspaceRole.ts`

Phase 2 must call or compose these contracts; it must not fork their role, workspace or capability logic inside UI components.

## Duplication and conflict findings

### 1. Duplicate notification entry on Admin

`WorkspaceShell.tsx` already renders a notification entry in its shared header. `app/admin/layout.tsx` additionally mounts `NotificationBell`, causing two notification entry points for Admin. The separate mount may be removed only after the shared header retains a valid authorised notification route.

### 2. Client-side company-name and unread-count queries

`WorkspaceShell.tsx` currently queries `companies` and `notification_events` directly from the client. These reads are presentation concerns, but company/workspace switching must not be inferred or authorised from these client queries.

### 3. No existing Company or Workspace Switcher

No existing component provides Organisation/Company switching or Workspace switching. A new switcher may be added only inside the existing shared shell and only with a server-authoritative API response.

### 4. No existing Global Search implementation

There is no canonical shared Global Search component. Phase 2 may introduce only an authorised navigation-search adapter over the visible navigation items. It must not query or invent business data sources.

### 5. Cached AuthContext after switching

`AuthContext` returns an already hydrated user without re-running `resolveAuthenticatedUser` for the same identity. A successful switch therefore requires a dedicated forced refresh path that bypasses this cache and atomically replaces all resolved context facts.

### 6. Legacy active-company fallback behaviour

`resolveActiveCompanyId` may return a fallback company identifier on auth or resolution failure. That behaviour is acceptable for its existing read paths but is not safe for authorising a context switch. The switching API must fail closed instead.

## Required server-authoritative boundary

The Phase 2 context endpoint must:

1. authenticate from the existing route access token;
2. derive the authenticated user server-side;
3. read only active memberships and active canonical companies;
4. validate the requested company against those memberships;
5. resolve enabled workspaces through Foundation contracts;
6. reject unsupported, inactive, stale or cross-company requests;
7. persist only the canonical active company field already used by the application;
8. return an approved landing route derived from the newly resolved authoritative context;
9. never trust client-supplied role, membership, driver, capability or route facts.

## Route and identity invariants

- Driver and Owner Driver share `/driver` only with valid same-company Driver evidence.
- Driver access never implies `/admin` access.
- Company Owner is not automatically a Shipper.
- Company Admin is not automatically a Fleet Operator.
- `MembershipRole` is not `BusinessWorkspace`.
- Route prefix is not permission.
- Switching must clear stale Driver, commercial, finance and admin facts before the next context is accepted.

## Inventory verdict

No repository contradiction blocks Phase 2.

Implementation may proceed by extending the existing `WorkspaceShell`, adding a narrow authenticated context API, adding forced AuthContext revalidation, removing only the confirmed duplicate Admin notification mount, and adding focused regression tests. The PR must remain Draft until independent validation is complete.
