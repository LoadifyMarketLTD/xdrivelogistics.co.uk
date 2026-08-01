# Agent Scope: WEB

> Product: Next.js website, authenticated workspaces, server API routes  
> Scope class: `WEB`

---

## Allowed paths

| Path | Notes |
|---|---|
| `app/**` | Next.js App Router pages and layouts |
| `lib/**` | Shared web utilities and server helpers |
| `middleware.ts` | Route protection |
| `public/**` | Static assets |
| `e2e/**` | Playwright end-to-end tests |
| `__tests__/**` | Vitest unit tests |
| `next.config.mjs` | Next.js configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `components.json` | shadcn/ui configuration |

## Conditionally allowed (with documented justification)

| Path | Condition |
|---|---|
| `package.json` / `package-lock.json` | Only when adding/updating a web-specific dependency; must document impact on other products |
| `tsconfig.json` | Only for web-specific TypeScript changes; must not break Expo or e2e types |
| `eslint.config.js` | Web-only lint rule changes; confirm compatibility with entire monorepo |
| `.github/workflows/ci.yml` | Web CI path filter adjustments only; must not affect Android or Expo jobs |
| `supabase/migrations/**` | Only when the web feature strictly requires a new column/table; must be reviewed as SUPABASE scope |

## Forbidden (do not modify without Platform Owner approval)

- `apps/driver-mobile/**` — Expo Driver scope
- `android-native/**` — Android Native scope
- `supabase/migrations/**` (unless co-approved as SUPABASE)
- Root lockfiles without a documented dependency reason
- `.github/workflows/android-native-ci.yml`
- Any production Supabase operations

## Required checks before merging

1. `npm run lint` — must pass with zero errors
2. `npm run typecheck` — must pass with zero errors
3. `npm run test:unit` — must pass
4. `npm run build` — must succeed (with placeholder env vars)
5. Relevant Playwright smoke tests pass in CI

## Cross-product impact declaration

Before modifying any shared file (root `package.json`, `tsconfig.json`, `middleware.ts`, shared `lib/` helpers used by API routes), declare:

```
SHARED IMPACT: <file> is used by <product(s)>. Expected impact: <none|describe>.
```

## Agent preflight declaration (required)

See `docs/agent-scopes/agent-preflight.md`.
