# PR #301 — Production Android Architecture Preflight

Date: 2026-07-27  
Branch: `copilot/transform-mobile-workspace-driver`

## Mandatory identity checks

1. Branch check: `copilot/transform-mobile-workspace-driver` ✅
2. PR check: `#301` ✅
3. `android-native` applicationId: `co.uk.xdrivelogistics.driver` ✅ (`android-native/app/build.gradle.kts`)
4. Kotlin package: `co.uk.xdrivelogistics.driver` ✅ (`android-native/app/src/main/java/co/uk/xdrivelogistics/driver/*`)
5. Expo preview package: `co.uk.xdrivelogistics.driver.preview` ✅ (`apps/driver-mobile/app.json`)
6. `/m` role: launcher/fallback deep-link surface (`app/m/page.tsx`, `app/driver/_components/MobileAppBanner.tsx`) ✅

## PR changed files (classified)

### Production Kotlin
- `android-native/README.md`

### Shared mobile API/backend
- `app/api/driver/mobile/_lib.ts`
- `app/api/driver/mobile/availability/route.ts`
- `app/api/driver/mobile/bids/route.ts`
- `app/api/driver/mobile/jobs/[id]/[action]/idempotency.ts`
- `app/api/driver/mobile/jobs/[id]/[action]/route.ts`
- `app/api/driver/mobile/messages/route.ts`
- `app/api/driver/mobile/nearby-jobs/route.ts`
- `app/api/driver/mobile/resources/route.ts`
- `supabase/migrations/20260727070500_mobile_pod_bid_idempotency_keys.sql`

### Expo preview/reference
- `apps/driver-mobile/App.tsx`
- `apps/driver-mobile/README.md`
- `apps/driver-mobile/docs/MOBILE_GAPS.md`
- `apps/driver-mobile/docs/apk-functional-audit-workbook.md`
- `apps/driver-mobile/eas.json`
- `apps/driver-mobile/jest.config.js`
- `apps/driver-mobile/package-lock.json`
- `apps/driver-mobile/package.json`
- `apps/driver-mobile/src/api/__tests__/jobs.test.ts`
- `apps/driver-mobile/src/api/availability.ts`
- `apps/driver-mobile/src/api/client.ts`
- `apps/driver-mobile/src/api/jobs.ts`
- `apps/driver-mobile/src/api/liveLoads.ts`
- `apps/driver-mobile/src/api/messages.ts`
- `apps/driver-mobile/src/app/DriverMobileApp.tsx`
- `apps/driver-mobile/src/auth/supabase.ts`
- `apps/driver-mobile/src/jobs/__tests__/podEvidence.test.ts`
- `apps/driver-mobile/src/jobs/__tests__/podValidation.test.ts`
- `apps/driver-mobile/src/jobs/__tests__/statusFlow.test.ts`
- `apps/driver-mobile/src/jobs/podEvidence.ts`
- `apps/driver-mobile/src/jobs/podValidation.ts`
- `apps/driver-mobile/src/jobs/statusFlow.ts`
- `apps/driver-mobile/src/jobs/types.ts`
- `apps/driver-mobile/src/live-loads/LiveLoadsScreen.tsx`
- `apps/driver-mobile/src/offline/__mocks__/async-storage.ts`
- `apps/driver-mobile/src/offline/__mocks__/expo-network.ts`
- `apps/driver-mobile/src/offline/__tests__/queue.test.ts`
- `apps/driver-mobile/src/offline/queue.ts`
- `apps/driver-mobile/src/utils/url.ts`

### Web launcher/fallback
- `app/driver/_components/MobileAppBanner.tsx`
- `app/driver/layout.tsx`
- `app/m/_components/DriverMobileAppVariant.tsx`
- `app/m/driver/layout.tsx`
- `app/m/driver/page.tsx`
- `app/m/page.tsx`

### Tests/docs/misc
- `docs/audit/mobile-client-consolidation-plan.md`
- `docs/audit/platform-interactive-matrix.json`
- `docs/audit/platform-interactive-summary.json`
- `e2e/mobile-api-contract.spec.ts`
- `e2e/mobile-driver-workspace.spec.ts`
- `middleware.ts`

## Architecture contradictions found in current PR state

1. Root `README.md` previously said `apps/driver-mobile` is canonical mobile experience. **Corrected** in current branch to `android-native` canonical and Expo preview-only.
2. `apps/driver-mobile/docs/apk-functional-audit-workbook.md` previously listed preview app package as `co.uk.xdrivelogistics.driver`. **Corrected** to `co.uk.xdrivelogistics.driver.preview`.
3. PR title/body text (outside repository files) still claims Expo is canonical. This cannot be corrected by file commit and must be edited directly in PR metadata.
