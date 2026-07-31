# Audit 21 — Inventar Master v1

> Production Certification Phase · Development Freeze Active  
> Acest document este inventarul tehnic inițial (V1), obținut direct din repository.

## Scope V1

- Repository root: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk`
- Surse inventariate: `app`, `lib`, `components`, `supabase`, `.github/workflows`, `e2e`, `__tests__`, `docs/audit`, `docs/master-matrix`.
- Regula: fără presupuneri; fiecare secțiune are referințe la fișiere concrete.

## Legend

`✅ Funcționează` · `⚠️ Funcționează parțial` · `❌ Defect` · `🚫 Blocant` · `📝 Observații` · `🔧 Recomandare`

---

## IM-01 · Inventar tehnic brut (repo-level)

| ID | Element | Rezultat inventariere | Dovadă |
|---|---|---|---|
| IM-01-01 | Total fișiere | 949 | scan complet repo (excluzând `.git`) |
| IM-01-02 | Total directoare | 399 | scan complet repo (excluzând `.git`) |
| IM-01-03 | Pagini App Router (`page.tsx`) | 168 | `app/**/page.tsx` |
| IM-01-04 | Rute API (`route.ts`) | 81 | `app/api/**/route.ts` |
| IM-01-05 | Layout-uri | 6 | `app/**/layout.tsx` |
| IM-01-06 | Componente (TS/TSX/JS/JSX) | 71 | `components`, `app/components`, `app/*/_components` |
| IM-01-07 | Migrations Supabase | 178 | `supabase/migrations/*.sql` |
| IM-01-08 | Tabele declarate în migrații | 62 | parse `CREATE TABLE` |
| IM-01-09 | Funcții SQL/RPC declarate | 95 | parse `CREATE FUNCTION` |
| IM-01-10 | Triggere declarate | 54 | parse `CREATE TRIGGER` |
| IM-01-11 | Policies RLS declarate | 229 | parse `CREATE POLICY` |
| IM-01-12 | Edge Functions | 2 (`notify-operational-event`, `send-email`) | `supabase/functions/*` |
| IM-01-13 | Workflow-uri GitHub Actions | 13 | `.github/workflows/*.yml` |

Status: ✅ inventariere tehnică executată pentru structurile majore.

---

## IM-02 · Inventar pe domenii (artefacte auditate)

| ID | Domeniu | Sursă principală | Status |
|---|---|---|---|
| IM-02-01 | Rute/pagini dashboard | `app/**/page.tsx` + `docs/master-matrix/01-page-inventory.md` | ✅ |
| IM-02-02 | API contracte | `app/api/**/route.ts` + `docs/master-matrix/02-api-inventory.md` | ✅ |
| IM-02-03 | Fluxuri business | `docs/master-matrix/03-workflow-decomposition.md` | ✅ |
| IM-02-04 | Roluri/permisiuni | `middleware.ts`, `lib/authRole.ts`, `lib/workspacePermissionResolver.ts` | ✅ |
| IM-02-05 | DB model + migrații | `database/schema.sql`, `supabase/migrations` | ✅ |
| IM-02-06 | RLS/policies | `supabase/migrations` + `supabase/tests/*.sql` | ✅ |
| IM-02-07 | Notificări/email/webhooks | `supabase/functions/*`, `app/api/super-admin/email-readiness/route.ts` | ✅ |
| IM-02-08 | CI/CD + quality gates | `.github/workflows/ci.yml` + validatoare dedicate | ✅ |
| IM-02-09 | Hosting/config/env | `netlify.toml`, `.env.example`, `next.config.mjs`, `middleware.ts` | ✅ |
| IM-02-10 | Teste unit/integration/e2e | `__tests__`, `e2e`, `vitest`, `playwright` | ✅ |

---

## IM-03 · Contracte și integrări identificate

| ID | Contract / integrare | Fișier(e) | Observație |
|---|---|---|---|
| IM-03-01 | FE ↔ API App Router | `app/**/page.tsx` + `app/api/**/route.ts` | Contract dominant intern |
| IM-03-02 | API ↔ Supabase (admin/validator) | `app/api/_lib/supabaseAdmin.ts` + rute API | Dependință critică runtime |
| IM-03-03 | Supabase DB webhook ↔ `notify-operational-event` | `supabase/functions/notify-operational-event/index.ts` | Header secret obligatoriu |
| IM-03-04 | Supabase Auth hook ↔ `send-email` | `supabase/functions/send-email/index.ts` | HMAC verificat |
| IM-03-05 | Email provider extern (Resend) | ambele edge functions | Fără `RESEND_API_KEY` → fail explicit |
| IM-03-06 | Client ↔ canonical host | `middleware.ts`, `lib/siteUrl.ts`, `netlify.toml` | Canonical host enforced condițional |

---

## IM-04 · Stări și tranziții (surse identificate)

| ID | Entitate | Sursă stare/tranziție | Status inventariere |
|---|---|---|---|
| IM-04-01 | Jobs lifecycle | `database/schema.sql` (`job_status`), migrații `079`, `082`, `20260720234500` | ✅ |
| IM-04-02 | Bids lifecycle | migrații `080_canonical_bid_status.sql`, `103_canonical_award_path.sql` | ✅ |
| IM-04-03 | Onboarding lifecycle | migrații `099-104`, `117`, `20260729170000` | ✅ |
| IM-04-04 | Invoice lifecycle | migrații `014`, `074`, `125-129`, `20260721224500` | ✅ |
| IM-04-05 | Notification lifecycle | `071`, `084`, `088`, `114-116`, `20260723222000` | ✅ |

---

## IM-05 · Feature flags, funcții neterminate, mock/placeholder

| ID | Tip | Dovadă | Status |
|---|---|---|---|
| IM-05-01 | Feature flags runtime | `supabase/migrations/20260725170000_platform_feature_flags.sql` | ✅ |
| IM-05-02 | UI management feature flags | `app/super-admin/settings/feature-flags/page.tsx` | ✅ |
| IM-05-03 | Placeholder footprint | `docs/audit/platform-interactive-summary.json` (`PLACEHOLDER: 9`) | ⚠️ |
| IM-05-04 | Broken targets | `docs/audit/platform-interactive-summary.json` (`BROKEN: 17`) | ❌ |
| IM-05-05 | Duplicate flows | `docs/audit/platform-interactive-summary.json` (`DUPLICATE: 189`) | ⚠️ |

---

## IM-06 · Evidence records (format operațional cerut)

| ID | Fișier + locație | Rută/Funcție | Rol testat | Condiții test | Rezultat așteptat | Rezultat real | Severitate | Impact | Recomandare exactă | Status verificare |
|---|---|---|---|---|---|---|---|---|---|---|
| IM-EV-01 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/middleware.ts:19-20,182-183` | Protecție rute | neautentificat + roluri mixte | acces direct URL la suprafețe protejate | redirect/login/forbidden consistent | prefixele protejate sunt definite explicit (`/super-admin`, `/broker`, `/admin`, `/driver`, `/customer`, `/m`) | MAJOR | reduce acces neautorizat | păstrare matrice rol+rute sincronizată cu noile pagini | ✅ |
| IM-EV-02 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/app/robots.ts:6-32` | Indexare | public + private pages | crawler rules | excludere dashboard-uri private | ✅ FIXED — `disallow` adăugat pentru 13 prefixe private (sincronizat cu `middleware.ts`) | CRITICAL | risc SEO/indexare accidentală suprafețe private | adaugă `disallow` explicit pentru suprafețe autentificate | ✅ |
| IM-EV-03 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/docs/audit/platform-interactive-summary.json:2-9` | Navigație interactivă | toate rolurile | audit static link/target | majoritatea fluxurilor închise | `CLOSED: 2`, `PARTIAL: 44`, `BROKEN: 17`, `DUPLICATE: 189` | CRITICAL | risc fluxuri rupte/ambigue | prioritizare fix pentru BROKEN, apoi consolidare duplicate | ❌ |
| IM-EV-04 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/functions/notify-operational-event/index.ts:4-7,351-358` | webhook notifications | sistem automat | apel fără secret valid | 401 | validare secret + constant-time compare prezentă | MAJOR | reduce replay/abuz webhook | menține secret rotation + monitorizare failed attempts | ✅ |
| IM-EV-05 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/functions/send-email/index.ts:36-71,211-218` | Auth email hook signature | extern (Supabase Auth) | payload nesemnat / semnătură invalidă | reject | 401 + verificare HMAC existentă | MAJOR | protecție împotriva spoofing | păstrare test de contract webhook cu semnătură invalidă | ✅ |
| IM-EV-06 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/netlify.toml:1-14` | hosting config | deploy | build cu env invalide | fail-fast/avertizare | config Netlify prezent; variabile critice indicate | MAJOR | stabilitate deploy | adaugă checklist automat pentru env completeness în CI | ⚠️ |

---

## IM-07 · Ce NU este încă validat în V1

Acest inventar V1 nu înlocuiește verificările live obligatorii:

- DNS/SSL certificate chain și redirect-uri la nivel infrastructură live.
- Starea reală a cron jobs din `cron.job` (necesită acces DB live).
- Limite operaționale reale (Supabase quotas, Realtime throughput, costuri Resend).
- Teste cross-browser/device reale pentru toate fluxurile rolurilor.

Status general V1: ⚠️ Funcționează parțial (inventar completat, verificare live încă în curs).

