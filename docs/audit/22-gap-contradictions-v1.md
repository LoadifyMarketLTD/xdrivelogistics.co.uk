# Audit 22 — Gap & Contradictions v1

> Production Certification Phase · Development Freeze Active  
> Raport V1 pentru contradicții reale între reguli, UI, API, DB, config și readiness operațional.

## Legend

`✅ Funcționează` · `⚠️ Funcționează parțial` · `❌ Defect` · `🚫 Blocant`

Severity: `CRITICAL` · `MAJOR` · `MINOR`

---

## GC-01 · Contradicții cross-layer (evidence-backed)

| ID | Contradicție | Dovadă | Severitate | Impact | Recomandare exactă | Status |
|---|---|---|---|---|---|---|
| GC-01-01 | Inventarul interactiv arată acoperire scăzută vs. obiectiv de audit complet | `docs/audit/platform-interactive-summary.json` (anterior `CLOSED: 2`, `PARTIAL: 44`, `BROKEN: 17`, `DUPLICATE: 189`) | CRITICAL | risc major de fluxuri rupte în producție | execută remediere etapizată: `BROKEN` → `PLACEHOLDER` → `DUPLICATE` | ⚠️ PARTIAL — scriptul de audit reparat (BROKEN: 17 → 0 după strip query params); noua stare: `BROKEN: 0`, `PARTIAL: 52`, `DUPLICATE: 281`. Cele 12 rute false-BROKEN rezolvate; `useSearchParams` adăugat în BrokerLoadsPage, BrokerQuotesPage, OperationsDiaryPage. |
| GC-01-02 | `robots` permite indexare globală, inclusiv suprafețe sensibile redirecționate | `app/robots.ts:7-11` (`allow: '/'`) + existență dashboard-uri protejate în `app/admin`, `app/super-admin`, `app/driver` | CRITICAL | risc SEO/indexare nedorită pentru URL-uri interne | `Disallow` explicit pentru suprafețe autentificate și pagini auth interne | ✅ FIXED — `app/robots.ts` adăugat `disallow` pentru 13 prefixe private (sincronizat cu `PROTECTED_PATH_PREFIXES` din `middleware.ts`) |
| GC-01-03 | Documentația declară mobile canonical în `apps/driver-mobile`, dar există și suprafață legacy web `/m/*` | `README.md:39-43` + `app/m/**/page.tsx` | MAJOR | implementări paralele, drift funcțional | stabilește contract de deprecare executabil (redirect/cutover/date limită) | ⚠️ |
| GC-01-04 | Audit index marchează workbook-urile ca “Not Started”, dar există rezultate automate deja generate | `docs/audit/00-audit-index.md` vs `docs/audit/automated-audit-report.md` | MINOR | confuzie operațională în progres | sincronizează status workbooks cu stadiul real | ⚠️ |
| GC-01-05 | Migrațiile/artefactele istorice au diferențe de total raportat în documente diferite (stare repository în evoluție) | `docs/audit/automated-audit-report.md` (178 fișiere) vs `docs/master-matrix/08-migration-validation.md` (snapshot istoric) | MAJOR | risc decizii pe date învechite | impune “generated_at” + “commit SHA” pe fiecare workbook | ⚠️ |
| GC-01-06 | Coverage API: majoritatea endpoint-urilor sunt PARTIAL, deși sunt în căi critice de business | `docs/master-matrix/02-api-inventory.md` (`PARTIAL: 62`, `CLOSED: 10`) | CRITICAL | risc contract drift FE/BE și regresii pe roluri | completează contract tests per endpoint (401/403/2xx/4xx + company isolation) | ❌ |

---

## GC-02 · Gaps pentru cerințele suplimentare cerute

| ID | Cerință | Observație actuală | Gap | Status |
|---|---|---|---|---|
| GC-02-01 | reguli business reale + contradicții | workbooks există (`14-business-rules`, `03-workflow-decomposition`) | lipsă completare sistematică pe fiecare regulă cu rezultat real live | ⚠️ |
| GC-02-02 | model complet de date + relații | model există în `database/schema.sql` + migrații | lipsește ERD final versionat cu trasabilitate la migrații | ⚠️ |
| GC-02-03 | stări/tranziții per entitate | stări există în enum + migrații canonice | lipsă matrice unică “state transition contract” validată live | ⚠️ |
| GC-02-04 | contracte FE/BE/Supabase/externe | inventar API/edge există | lipsesc contract tests complete pentru majoritatea endpoint-urilor | ❌ |
| GC-02-05 | integrări + webhook-uri | `notify-operational-event`, `send-email` identificate | lipsesc dovezi live complete pentru retries/failure-handling pe toate scenariile | ⚠️ |
| GC-02-06 | cron/scheduled jobs | referințe la `pg_cron` în audit package; fără workflow schedule în GitHub Actions | lipsă inventar live din `cron.job` | ⚠️ |
| GC-02-07 | email templates + communication flows | template logic există în ambele edge functions | lipsește catalog centralizat template→trigger→audiență→fallback | ⚠️ |
| GC-02-08 | hosting/DNS/SSL/redirect | Netlify + security headers + canonical host logic existente | DNS/SSL chain și redirect-uri live încă neprobate în acest V1 | ⚠️ |
| GC-02-09 | medii dev/preview/staging/prod | config dev/CI/Netlify prezent | lipsă dovadă formală pentru staging dedicat și parity gates | ⚠️ |
| GC-02-10 | cod mort/duplicate/paralel | `DUPLICATE: 189` în matrice interactivă | necesar plan de deduplicare și arhivare controlată | ❌ |
| GC-02-11 | TODO/FIXME/mock/placeholder | footprint semnificativ placeholder/stub în scan global | necesară listă triată: test-only vs runtime-user-visible | ⚠️ |
| GC-02-12 | costuri, limite, scalabilitate, recovery | menționate în audit planuri | lipsesc măsurători live (rate limits, load, cost baseline, RTO/RPO validate) | ⚠️ |

---

## GC-03 · Verificări cu formatul de dovadă cerut (V1)

| ID | Fișier + locație | Rută/Funcție | Rol testat | Condiții test | Rezultat așteptat | Rezultat real | Severitate | Impact | Recomandare exactă | Status verificare |
|---|---|---|---|---|---|---|---|---|---|---|
| GC-EV-01 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/app/robots.ts:6-32` | robots policy | crawler/public | indexability check | private surfaces not indexable | ✅ FIXED — `disallow` adăugat pentru 13 prefixe: `/super-admin`, `/admin`, `/broker`, `/driver`, `/customer`, `/m`, `/login`, `/register`, `/auth`, `/pending-approval`, `/onboarding`, `/forbidden`, `/reset-password` | CRITICAL | indexare accidentală URL private | introdu `disallow` pentru `/admin`, `/super-admin`, `/driver`, `/customer`, `/broker`, `/login`, `/register` | ✅ |
| GC-EV-02 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/docs/master-matrix/02-api-inventory.md:120-124` | API coverage aggregate | toate rolurile | contract coverage check | majoritatea endpoint-urilor fully covered | 62 PARTIAL / 10 CLOSED | CRITICAL | risc regresii și inconsistență role isolation | transformă toate endpoint-urile PARTIAL în CLOSED prin test matrix standard | ❌ |
| GC-EV-03 | `docs/audit/platform-interactive-summary.json` (regenerat) | interactive routes consistency | toate rolurile | navigation matrix check | low broken/duplicate counts | ⚠️ PARTIAL — BROKEN: 17 → 0 (script reparat); PARTIAL: 52; `useSearchParams` adăugat în BrokerLoadsPage, BrokerQuotesPage, OperationsDiaryPage | CRITICAL | UX rupt și căi multiple către același flux | remediere tehnică + refactor navigație, apoi rerun audit script | ⚠️ |
| GC-EV-04 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/functions/send-email/index.ts:36-71` | webhook signature verification | integrare externă | forged request | request respins | HMAC + constant-time compare implementate | MAJOR | reduce spoofing pe email hook | păstrează și teste negative obligatorii în CI integration lane | ✅ |
| GC-EV-05 | `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/functions/notify-operational-event/index.ts:355-358` | x-xdrive-webhook-secret auth | integrare externă | invalid secret | 401 | 401 implementat | MAJOR | protecție webhook queue processor | activează rotație periodică secret + audit attempts | ✅ |

---

## GC-04 · Prioritizare de remediere (V1)

1. **P0 / Blocant**: indexare necontrolată, broken targets, coverage API critic incomplet.
2. **P1**: eliminare duplicate/paralelisme (`/m` legacy vs mobile canonical, navigație duplicată).
3. **P1**: consolidare contracte cross-layer (UI↔API↔DB) și verificări RLS reale pe toate fluxurile sensibile.
4. **P2**: cost/perf/recovery live baselines (SLO, RTO/RPO, quota burn).

Status general: ⚠️ Funcționează parțial; există defecte critice confirmate ce necesită remediere înainte de certificare finală.

