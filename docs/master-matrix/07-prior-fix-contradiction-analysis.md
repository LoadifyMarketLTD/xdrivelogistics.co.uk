# Prior Fix Contradiction Analysis

**Generated**: 2026-07-25  
**Scope**: Reconciling claimed prior remediations against current HEAD

---

## Contradiction 1: Notification Retry Workflow

### Prior claim
A prior agent session reported that "failed notification retry and failure details had been implemented."

### Current HEAD investigation

| Item | Previous claimed | Current HEAD | Verdict |
|---|---|---|---|
| Retry endpoint | Claimed to exist | NOT FOUND — no POST handler in /api/super-admin/platform or any notifications route | FALSE CLAIM |
| Retry UI button | Claimed to exist | NOT FOUND — super-admin/notifications/page.tsx renders SuperAdminLiveTablePage (read-only, no action column) | FALSE CLAIM |
| Failure detail view | Claimed to exist | Status badge with red colour for `status === 'failed'` ONLY — no detail expansion, no message | PARTIAL at best |

### Exact file evidence

**`app/super-admin/notifications/page.tsx`**:
- Uses `SuperAdminLiveTablePage` generic component
- Renders columns: title, type, message, status (colour-coded), sent timestamp
- NO retry button column
- NO action prop passed to SuperAdminLiveTablePage
- endpoint: `/api/super-admin/platform?section=notifications` (GET only)

**`app/api/super-admin/platform/route.ts`**:
- Exports only `GET` handler
- `section=notifications` → reads `notification_events` and returns formatted rows
- No `POST` handler for retry
- No retry action in response payload

### Git history
```
git log --oneline --all --grep="retry" → (empty — no commit mentions retry)
git log --oneline --all --grep="notification" → no retry commits found
```

### True status

| Item | Status | Required Fix |
|---|---|---|
| Retry endpoint | NOT_IMPLEMENTED | Add POST /api/super-admin/notifications/[id]/retry endpoint |
| Retry UI | NOT_IMPLEMENTED | Add retry button column to SuperAdminLiveTablePage or custom notifications page |
| Failure detail | PLACEHOLDER | Status badge only — no structured error message from edge function |

**Priority**: P2 — operational governance. Not P0. Does not block driver operations.

---

## Contradiction 2: Web /m/ Driver Notifications

### Prior claim
Prior sessions treated the web /m/ driver variant as correctly reading notifications.

### Current HEAD investigation

**`app/m/_components/DriverMobileAppVariant.tsx` line 397** (before this PR's fix):
```typescript
const notificationsRes = await supabase
  .from('notifications')              // ← reading zombie table
  .select('id,title,body,type,read_at,created_at')
  .eq('user_id', user.id)
  ...
```

The `notifications` table has zero writers. The web mobile variant was showing an empty notification list to all drivers.

### Fix applied in this PR
Changed to read `notification_events` (canonical table) and map to display format.

### True status

| Item | Previous status | Current status after fix |
|---|---|---|
| Web /m/ driver notification source | notifications (zombie table, empty) | notification_events (canonical) |
| Notification display | Always empty | Displays real events |

---

## Contradiction 3: Android Notifications "Working"

### Prior claim
Android notification delivery was treated as functional in some prior analysis.

### Current HEAD investigation

**`android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/ApiClient.kt` line 298**:
```kotlin
"/rest/v1/notifications?select=id,title,body,type,read_at,created_at&user_id=eq.$encodedUserId..."
```

This reads from `notifications` via Supabase REST. The `notifications` table has:
- RLS enabled (company membership policy)
- Zero rows (confirmed by lack of any writer in application code)
- Zero triggers writing to it
- No edge function writing to it

### True status

Android drivers see zero notifications. This is a P0 launch blocker.

### Fix applied in this PR
Bridge trigger migration `20260725160000_notification_events_to_notifications_bridge.sql` (requires manual SQL application).

---

## Summary Table: All Prior Contradictions

| Prior claimed fix | Files claimed | Git commit | Current HEAD | True status | Required fix |
|---|---|---|---|---|---|
| Notification retry endpoint implemented | Unknown | Not found in git log | Not present | NOT_IMPLEMENTED | Add POST retry endpoint (P2) |
| Retry UI in super-admin notifications | Unknown | Not found in git log | Not present | NOT_IMPLEMENTED | Add retry button (P2) |
| Web /m/ driver notifications working | DriverMobileAppVariant.tsx | Not a fix commit | Reads zombie table | BROKEN | Fixed in this PR |
| Android notifications working | android-native/data/ApiClient.kt | Not applicable | Reads zombie table | BROKEN | Bridge migration (P0) |
| notification_events→notifications bridge exists | None | Not found | Not present | NOT_IMPLEMENTED | Bridge migration (P0) |
