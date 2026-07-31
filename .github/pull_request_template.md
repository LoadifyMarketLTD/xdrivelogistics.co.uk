## Product scope

<!-- Select exactly one. Remove the others. -->

- [ ] **WEB** — Next.js website / server API (`app/`, `lib/`, `middleware.ts`, `public/`, `e2e/`)
- [ ] **EXPO_DRIVER** — Expo React Native driver app (`apps/driver-mobile/`)
- [ ] **ANDROID_NATIVE_DRIVER** — Kotlin Android driver app (`android-native/`)
- [ ] **SUPABASE** — Migrations, RLS, edge functions (`supabase/`, `database/`)
- [ ] **CROSS** — Affects more than one product (requires explicit Platform Owner approval)

---

## Summary

<!-- Describe what this PR does and why. -->

---

## Changed paths

<!-- List every file path this PR modifies. -->

- 

---

## Cross-product justification

<!-- If you selected CROSS above, or if you changed any shared root file, fill this in.
     Otherwise write "N/A". -->

---

## Root package / lockfile justification

<!-- Did this PR change package.json or package-lock.json?
     If yes, state the exact dependency change and confirm no other product is broken. -->

N/A

---

## Supabase migration declaration

<!-- Did this PR add a new migration file?
     If yes, confirm the migration has NOT been applied to Production. -->

- [ ] No migration was added
- [ ] Migration added — NOT applied to Production; rollback plan: <!-- describe -->

---

## Production safety declaration

- [ ] No Supabase Production migration was executed
- [ ] No Production data was modified
- [ ] No production secrets are present in this PR

---

## Required checks

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run build` passes
- [ ] CI is green

---

## Agent preflight (AI-authored PRs only)

<!-- If this PR was authored by an AI agent, paste the completed preflight block from
     docs/agent-scopes/agent-preflight.md here. -->
