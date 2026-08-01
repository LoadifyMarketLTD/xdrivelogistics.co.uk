# Agent Scope: ANDROID_NATIVE_DRIVER

> Product: Kotlin Android Native driver application  
> Scope class: `ANDROID_NATIVE_DRIVER`

---

## Allowed paths

| Path | Notes |
|---|---|
| `android-native/**` | Complete Android Native app |
| `.github/workflows/android-native-ci.yml` | Android-specific CI workflow only |

## Conditionally allowed (with documented justification)

| Path | Condition |
|---|---|
| `docs/audit/08-android-functional.md` | Android functional audit updates only |
| `docs/audit/android-native-*.md` | Android audit documentation |

## Forbidden (do not modify without Platform Owner approval)

- `app/**` — Next.js web scope
- `lib/**` — Web library scope
- `apps/driver-mobile/**` — Expo Driver scope
- `supabase/migrations/**` — Supabase scope
- Root `package.json`, `package-lock.json`, `tsconfig.json`
- `middleware.ts`, `next.config.mjs`
- Any production Supabase operations
- Any web or Expo shared Auth/session libraries

## Required checks before merging

1. `cd android-native && ./gradlew testDebugUnitTest lintDebug` — must pass
2. `cd android-native && ./gradlew assembleDebug` — must succeed
3. APK checksum must be published as workflow artifact

## Integration report (required when shared API contracts change)

If the Android app changes an API call path or authentication header pattern, file a cross-product report:

```
INTEGRATION REPORT:
  Changed API: <endpoint>
  Impact on web API routes: <none|describe>
  Impact on Supabase RLS/schema: <none|describe>
  Required migration: <none|migration file>
```

## Agent preflight declaration (required)

See `docs/agent-scopes/agent-preflight.md`.
