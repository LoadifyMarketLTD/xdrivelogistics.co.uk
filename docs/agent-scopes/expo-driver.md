# Agent Scope: EXPO_DRIVER

> Product: Expo React Native driver mobile application  
> Scope class: `EXPO_DRIVER`

---

## Allowed paths

| Path | Notes |
|---|---|
| `apps/driver-mobile/**` | Complete Expo driver app |

## Conditionally allowed (with documented justification)

| Path | Condition |
|---|---|
| `package.json` / `package-lock.json` (root) | Only when a shared dependency version must be pinned for Expo compatibility; must document web and Android impact |
| `.github/workflows/ci.yml` (Expo job only) | Expo CI path filter or step adjustments only |

## Forbidden (do not modify without Platform Owner approval)

- `app/**` — Next.js web scope
- `lib/**` — Web library scope (unless the file is explicitly shared and documented as such)
- `android-native/**` — Android Native scope
- `supabase/migrations/**` — Supabase scope
- Root `tsconfig.json`, `tailwind.config.js`, `next.config.mjs`
- Any production Supabase operations

## Required checks before merging

1. `cd apps/driver-mobile && npm run typecheck` — must pass
2. `cd apps/driver-mobile && npm run lint` (if configured) — must pass
3. Root web CI must not regress if root dependencies were changed

## Cross-product impact declaration

Before modifying any root dependency (`package.json`, `package-lock.json`), declare:

```
SHARED IMPACT: <package> version change may affect <web|android>. Verified impact: <none|describe>.
```

## Agent preflight declaration (required)

See `docs/agent-scopes/agent-preflight.md`.
