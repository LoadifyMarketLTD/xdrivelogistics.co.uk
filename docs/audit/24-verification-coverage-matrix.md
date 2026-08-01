# Verification Coverage Matrix

> Snapshot for commit `38977d4d06bfb9fbaf55803f8a480262d8d3f262` on 2026-08-01.

| Area | Inventory Size | Static Evidence | Runtime Evidence in This Audit | Current Disposition | Primary Sources |
|---|---:|---|---|---|---|
| Repository structure | 969 files / 402 dirs | Yes | Filesystem scan | PASS | session scan, `docs/audit/21-inventar-master-v1.md` |
| Pages / routes | 168 pages | Yes | Interactive audit regenerated | PARTIAL | `docs/master-matrix/01-page-inventory.md`, `docs/audit/platform-interactive-summary.json` |
| API handlers | 81 handlers / 72 business APIs | Yes | Automated audit + committed contract specs | FAIL | `docs/master-matrix/02-api-inventory.md`, `app/api/**` |
| Workflow controls | 12 major workflows decomposed | Yes | Indirect via committed tests | PARTIAL | `docs/master-matrix/03-workflow-decomposition.md` |
| Role & permissions | 6 canonical app roles + workspace roles/capabilities | Yes | Unit tests executed by `npm run audit:auto` | PARTIAL | `lib/authRole.ts`, `lib/workspaceRole.ts`, `__tests__/*permission*` |
| Security controls | critical route/storage/webhook controls | Yes | Automated audit executed | PARTIAL | `docs/audit/automated-audit-report.md` |
| Database schema | 178 migrations, 21 views, 182 function defs, 227 policies | Yes | Automated audit executed | PARTIAL | `supabase/migrations`, `docs/audit/automated-audit-report.md` |
| Notifications | queue + 2 edge functions | Yes | No end-to-end live delivery rerun | PARTIAL | `supabase/functions/*`, `README.md` |
| Files / buckets | 3 private buckets | Yes | No live object round-trip rerun | PARTIAL | `supabase/migrations/032_storage_buckets.sql` |
| Android / mobile | Expo app + native app | Yes | No physical-device rerun | FAIL | `apps/driver-mobile/**`, `android-native/**`, `.github/workflows/android-native-ci.yml` |
| Performance | baseline criteria defined | Weak | No measured benchmarks rerun | FAIL | `docs/audit/09-performance-audit.md` |
| Production infra | deployment/readiness criteria defined | Partial | No live deployment validation | FAIL | `docs/audit/10-production-readiness.md` |

## Matrix Conclusion

The inventory coverage is broad, but runtime verification coverage is materially lower than the discovered surface area. That mismatch is the core reason the audit outcome is **NO GO**.
