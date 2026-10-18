# PR 680: prepared concurrency verification, not executed

Target: existing disposable Supabase preview `wumqoppqqlxkaphhgzks` only.
Production must never receive this test schema. No provider credentials or calls are involved.

`PR680_CONCURRENCY_SETUP_PENDING.sql` creates private schema `audit_pr680_concurrency`, clones the deployed financial table shapes and functions, and inserts five test invoices there. Public business tables remain empty. It preserves the actual payment normalization, overpayment, external-payment and balance-application triggers. Other business lifecycle triggers are not copied; the separate rollback-only integration test already exercises the full public schema.

This setup was **not executed**: automatic approval rejected its persistent intermediate schema/fixtures because the preceding verification was scoped to rollback-only tests. No concurrency PASS is claimed. Approval must explicitly cover temporarily committing this private schema and removing it after the tests.

After approval, apply the setup on the preview and run each pair through two concurrent database requests. Each request must be an independent transaction. The 2-second hold keeps the first transaction open; verify distinct `pg_backend_pid()` values in `results`.

| Scenario | Request A | Request B |
| --- | --- | --- |
| Duplicate Checkout | `SELECT audit_pr680_concurrency.prepare('68000000-0000-4000-8000-000000000101','duplicate','a',2)` | `SELECT audit_pr680_concurrency.prepare('68000000-0000-4000-8000-000000000101','duplicate','b',0)` |
| External payment | `SELECT audit_pr680_concurrency.prepare('68000000-0000-4000-8000-000000000102','external','a',2)` | `SELECT audit_pr680_concurrency.external_payment('68000000-0000-4000-8000-000000000102','b',0)` |
| Cancellation | `SELECT audit_pr680_concurrency.prepare('68000000-0000-4000-8000-000000000103','cancellation','a',2)` | `SELECT audit_pr680_concurrency.cancel('68000000-0000-4000-8000-000000000103','b',0)` |
| Economic duplicate | `SELECT audit_pr680_concurrency.webhook('68000000-0000-4000-8000-000000000104','economic','a','evt_economic_a',2)` | `SELECT audit_pr680_concurrency.webhook('68000000-0000-4000-8000-000000000104','economic','b','evt_economic_b',0)` |
| Same event | `SELECT audit_pr680_concurrency.webhook('68000000-0000-4000-8000-000000000105','same-event','a','evt_same',2)` | `SELECT audit_pr680_concurrency.webhook('68000000-0000-4000-8000-000000000105','same-event','b','evt_same',0)` |

Assert one active attempt for the duplicate Checkout and equal returned attempt IDs. For the external race, either the external payment is rejected after reservation, or it commits first and reduces the reservation by exactly 2000 minor units; payment plus reservation must never exceed 10000. For cancellation, either cancellation wins and reservation is refused, or reservation wins and cancellation is refused. A void invoice must never retain an active attempt.

Both webhook races must end with one 100 GBP ledger entry, a paid invoice/attempt and no errors. Different event IDs must be economically deduplicated; the same event ID must be event-deduplicated. Check each result before calling any scenario passed.

Cleanup is scoped to the private test schema:

```sql
DROP SCHEMA audit_pr680_concurrency CASCADE;
```

Then verify `to_regnamespace('audit_pr680_concurrency') IS NULL` and that public company, invoice and auth-user counts remain zero. Retain the observed outcomes and backend IDs in the checkpoint. Test setup/cleanup migration-history entries, if the connector creates them, are preview-only and must not be promoted to production.
