/**
 * Production-linked database integration test for the device-token atomic RPCs.
 *
 * Requires DATABASE_URL or PGDATABASE to be set pointing at an ephemeral local
 * PostgreSQL instance (e.g. DATABASE_URL=******localhost:5432/xdrive_test,
 * or via PGHOST/PGUSER/PGDATABASE env vars for Unix-socket / peer-auth connections).
 * Automatically skipped when neither is set.
 *
 * Applies the real migration SQL from the repository to create the table and RPCs,
 * then exercises the actual PostgreSQL functions and asserts persisted state for
 * all eight required lifecycle scenarios.
 */

import { beforeAll, afterAll, afterEach, describe, expect, test } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const PGDATABASE   = process.env.PGDATABASE   ?? '';
const SKIP = !DATABASE_URL && !PGDATABASE;

// ─── Fixed UUIDs ────────────────────────────────────────────────────────────
const USER_A    = '00000000-0000-0000-0000-000000000001';
const USER_B    = '00000000-0000-0000-0000-000000000002';
const DRIVER_A  = '10000000-0000-0000-0000-000000000001';
const DRIVER_B  = '10000000-0000-0000-0000-000000000002';
const COMPANY   = '20000000-0000-0000-0000-000000000001';

// Tokens are deliberately long (>= 100 chars) to satisfy the contract minimum.
const TOKEN_A1  = 'tok-a1-' + 'a'.repeat(140);
const TOKEN_A2  = 'tok-a2-' + 'b'.repeat(140);
const TOKEN_B1  = 'tok-b1-' + 'c'.repeat(140);
const INSTALL_1 = 'install-uuid-1';
const INSTALL_2 = 'install-uuid-2';

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function makeClient(): Promise<Client> {
  // When DATABASE_URL is set (CI service container), use it; otherwise rely on
  // the standard PGHOST / PGUSER / PGDATABASE / PGPASSWORD env vars (Unix-socket
  // peer-auth for local development).
  const c = DATABASE_URL ? new Client({ connectionString: DATABASE_URL }) : new Client();
  await c.connect();
  return c;
}

async function register(
  client: Client,
  params: { userId: string; driverId: string; token: string; installId: string; gen: number },
): Promise<string> {
  const { rows } = await client.query<{ result: string }>(
    `SELECT public.driver_register_device_token_atomic($1,$2,$3,$4,$5,$6,$7,$8) AS result`,
    [params.userId, params.driverId, COMPANY, params.token, 'android',
     'co.uk.xdrivelogistics.driver', params.installId, params.gen],
  );
  return rows[0].result;
}

async function unregister(
  client: Client,
  params: { userId: string; driverId: string; token: string; installId: string; gen: number },
): Promise<string> {
  const { rows } = await client.query<{ result: string }>(
    `SELECT public.driver_unregister_device_token_atomic($1,$2,$3,$4,$5) AS result`,
    [params.userId, params.driverId, params.token, params.installId, params.gen],
  );
  return rows[0].result;
}

async function latestRow(client: Client, installId: string) {
  const { rows } = await client.query(
    `SELECT user_id, driver_id, token, registration_generation, revoked_at
     FROM public.driver_device_tokens
     WHERE installation_id = $1
     ORDER BY registration_generation DESC, updated_at DESC
     LIMIT 1`,
    [installId],
  );
  return rows[0] ?? null;
}

async function rowCount(client: Client, installId: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.driver_device_tokens WHERE installation_id = $1`,
    [installId],
  );
  return Number(rows[0].n);
}

async function driverToken(client: Client, driverId: string): Promise<string | null> {
  const { rows } = await client.query(
    `SELECT device_token FROM public.drivers WHERE id = $1`,
    [driverId],
  );
  return rows[0]?.device_token ?? null;
}

// ─── Suite ───────────────────────────────────────────────────────────────────
describe.skipIf(SKIP)('Device-token RPC lifecycle — real PostgreSQL', () => {
  let admin: Client | undefined;

  beforeAll(async () => {
    admin = await makeClient();

    // Ensure roles referenced by the migration exist (idempotent in test DB).
    // DO blocks do not support parameters; use literal SQL for each role name.
    for (const role of ['authenticated', 'service_role']) {
      await admin.query(`CREATE ROLE ${role}`).catch(() => { /* already exists */ });
    }

    // Stub auth schema + users table (FK dependency of driver_device_tokens).
    await admin.query(`CREATE SCHEMA IF NOT EXISTS auth`);
    await admin.query(`
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      )
    `);

    // Stub public.companies (FK dependency).
    await admin.query(`
      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      )
    `);

    // Stub public.drivers with device_token column (FK + legacy sync target).
    await admin.query(`
      CREATE TABLE IF NOT EXISTS public.drivers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id),
        device_token text
      )
    `);

    // Apply the real migration SQL.
    // Strip the NOTIFY command (requires PostgREST; harmless to omit in tests).
    const migPath = join(
      __dirname,
      '../supabase/migrations/20260728120000_driver_device_tokens_lifecycle.sql',
    );
    const sql = readFileSync(migPath, 'utf-8')
      .replace(/NOTIFY\s+pgrst[^;]*;/gi, '/* NOTIFY stripped */');
    await admin.query(sql);

    // Seed fixed test identities (two separate rows per INSERT to avoid parameter-count issues).
    await admin.query(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER_A]);
    await admin.query(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER_B]);
    await admin.query(`INSERT INTO public.companies (id) VALUES ($1) ON CONFLICT DO NOTHING`, [COMPANY]);
    await admin.query(`INSERT INTO public.drivers (id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [DRIVER_A, USER_A]);
    await admin.query(`INSERT INTO public.drivers (id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [DRIVER_B, USER_B]);
  });

  afterEach(async () => {
    // Reset all device-token rows and driver.device_token between tests.
    await admin!.query(`DELETE FROM public.driver_device_tokens`);
    await admin!.query(`UPDATE public.drivers SET device_token = NULL WHERE id = $1 OR id = $2`, [DRIVER_A, DRIVER_B]);
  });

  afterAll(async () => {
    await admin?.end();
  });

  // ── Scenario 1: owner A generation N accepted ────────────────────────────
  test('1. owner A gen N is accepted and committed to the database', async () => {
    const result = await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 5,
    });
    expect(result).toBe('accepted');

    const row = await latestRow(admin!, INSTALL_1);
    expect(row).not.toBeNull();
    expect(row.user_id).toBe(USER_A);
    expect(row.driver_id).toBe(DRIVER_A);
    expect(row.token).toBe(TOKEN_A1);
    expect(Number(row.registration_generation)).toBe(5);
    expect(row.revoked_at).toBeNull();

    // Legacy driver token synchronized.
    expect(await driverToken(admin!, DRIVER_A)).toBe(TOKEN_A1);
  });

  // ── Scenario 2: owner B gen N+1 accepted; A's row is revoked ─────────────
  test('2. newer owner B gen N+1 accepted; owner A gen N row is revoked', async () => {
    await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 5,
    });

    const result = await register(admin!, {
      userId: USER_B, driverId: DRIVER_B, token: TOKEN_B1,
      installId: INSTALL_1, gen: 6,
    });
    expect(result).toBe('accepted');

    // Newest active row belongs to B.
    const row = await latestRow(admin!, INSTALL_1);
    expect(row.user_id).toBe(USER_B);
    expect(row.driver_id).toBe(DRIVER_B);
    expect(Number(row.registration_generation)).toBe(6);
    expect(row.revoked_at).toBeNull();

    // Total rows: one accepted for A (revoked) + one accepted for B (active).
    expect(await rowCount(admin!, INSTALL_1)).toBe(2);

    // A's token is revoked in driver_device_tokens.
    const { rows: aRows } = await admin!.query(
      `SELECT revoked_at FROM public.driver_device_tokens
       WHERE token = $1`,
      [TOKEN_A1],
    );
    expect(aRows[0].revoked_at).not.toBeNull();

    // drivers.device_token now points to B.
    expect(await driverToken(admin!, DRIVER_B)).toBe(TOKEN_B1);
  });

  // ── Scenario 3: delayed A gen N returns stale; zero mutation ─────────────
  test('3. delayed owner A gen N after B gen N+1 returns stale and performs zero mutation', async () => {
    await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 5,
    });
    await register(admin!, {
      userId: USER_B, driverId: DRIVER_B, token: TOKEN_B1,
      installId: INSTALL_1, gen: 6,
    });

    // Capture pre-call state.
    const countBefore = await rowCount(admin!, INSTALL_1);
    const rowBefore   = await latestRow(admin!, INSTALL_1);

    // Delayed A (gen 5) arrives after B (gen 6).
    const result = await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 5,
    });
    expect(result).toBe('stale');

    // No new rows created; state unchanged.
    expect(await rowCount(admin!, INSTALL_1)).toBe(countBefore);
    const rowAfter = await latestRow(admin!, INSTALL_1);
    expect(rowAfter.user_id).toBe(rowBefore.user_id);
    expect(Number(rowAfter.registration_generation)).toBe(Number(rowBefore.registration_generation));
    expect(rowAfter.revoked_at).toBeNull();

    // B's driver token updated to TOKEN_B1.
    expect(await driverToken(admin!, DRIVER_B)).toBe(TOKEN_B1);
    // A's driver token is unchanged (RPC only synchronizes the new owner's
    // drivers.device_token; TOKEN_A1 is revoked in driver_device_tokens but
    // the drivers row is not cleared by a different user's registration).
    // The stale call must not have mutated A's driver record either.
    expect(await driverToken(admin!, DRIVER_A)).toBe(TOKEN_A1);
  });

  // ── Scenario 4: concurrent A/B — higher generation always wins ───────────
  test('4. concurrent A/B completion: final state always holds the higher generation', async () => {
    // Two concurrent clients racing for the same installation.
    const clientX = await makeClient();
    const clientY = await makeClient();
    try {
      // Race: gen 7 and gen 8 fire concurrently; 8 must be the committed winner.
      const [resLow, resHigh] = await Promise.all([
        register(clientX, {
          userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
          installId: INSTALL_1, gen: 7,
        }),
        register(clientY, {
          userId: USER_B, driverId: DRIVER_B, token: TOKEN_B1,
          installId: INSTALL_1, gen: 8,
        }),
      ]);

      // Both may return 'accepted' (serial order: low first, then high)
      // or the higher may be 'accepted' and the lower 'stale'/'accepted'.
      // The critical invariant: the final active row is always gen 8.
      const row = await latestRow(admin!, INSTALL_1);
      expect(Number(row.registration_generation)).toBe(8);
      expect(row.user_id).toBe(USER_B);
      expect(row.revoked_at).toBeNull();

      // Neither result should be an unexpected error string.
      expect(['accepted', 'stale', 'duplicate']).toContain(resLow);
      expect(['accepted', 'stale', 'duplicate']).toContain(resHigh);
    } finally {
      await clientX.end();
      await clientY.end();
    }
  });

  // ── Scenario 5: exact duplicate is idempotent ─────────────────────────────
  test('5. exact duplicate registration is idempotent and creates no extra rows', async () => {
    await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 3,
    });
    const countAfterFirst = await rowCount(admin!, INSTALL_1);

    const result = await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 3,
    });
    expect(result).toBe('duplicate');

    // No additional rows.
    expect(await rowCount(admin!, INSTALL_1)).toBe(countAfterFirst);

    // Active row state unchanged.
    const row = await latestRow(admin!, INSTALL_1);
    expect(row.user_id).toBe(USER_A);
    expect(Number(row.registration_generation)).toBe(3);
    expect(row.revoked_at).toBeNull();
  });

  // ── Scenario 6: token rotation revokes old, transfers new atomically ──────
  test('6. token rotation revokes previous token and synchronizes drivers.device_token atomically', async () => {
    await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 1,
    });
    expect(await driverToken(admin!, DRIVER_A)).toBe(TOKEN_A1);

    // Owner A rotates to a new FCM token on the same installation.
    const result = await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A2,
      installId: INSTALL_1, gen: 2,
    });
    expect(result).toBe('accepted');

    // Old token is revoked.
    const { rows: oldRows } = await admin!.query(
      `SELECT revoked_at FROM public.driver_device_tokens WHERE token = $1`,
      [TOKEN_A1],
    );
    expect(oldRows[0].revoked_at).not.toBeNull();

    // New token is active.
    const row = await latestRow(admin!, INSTALL_1);
    expect(row.token).toBe(TOKEN_A2);
    expect(row.revoked_at).toBeNull();

    // drivers.device_token updated to new token.
    expect(await driverToken(admin!, DRIVER_A)).toBe(TOKEN_A2);
  });

  // ── Scenario 7: stale unregister cannot revoke newer registration ─────────
  test('7. delayed stale unregister cannot revoke a newer registration', async () => {
    // A registers with gen 3 then B takes over with gen 4.
    await register(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 3,
    });
    await register(admin!, {
      userId: USER_B, driverId: DRIVER_B, token: TOKEN_B1,
      installId: INSTALL_1, gen: 4,
    });

    // A's logout (gen 3) arrives late.
    const result = await unregister(admin!, {
      userId: USER_A, driverId: DRIVER_A, token: TOKEN_A1,
      installId: INSTALL_1, gen: 3,
    });
    expect(result).toBe('stale');

    // B's registration is still active.
    const row = await latestRow(admin!, INSTALL_1);
    expect(row.user_id).toBe(USER_B);
    expect(row.revoked_at).toBeNull();

    // B's legacy driver token is preserved.
    expect(await driverToken(admin!, DRIVER_B)).toBe(TOKEN_B1);
  });

  // ── Scenario 8: table/RPC access control ─────────────────────────────────
  test('8. authenticated role cannot SELECT from driver_device_tokens or execute RPCs directly', async () => {
    // Verify privilege metadata: authenticated must have no table privileges.
    const { rows: tablePrivs } = await admin!.query(`
      SELECT has_table_privilege('authenticated', 'public.driver_device_tokens', 'SELECT') AS can_select
    `);
    expect(tablePrivs[0].can_select).toBe(false);

    const { rows: insertPrivs } = await admin!.query(`
      SELECT has_table_privilege('authenticated', 'public.driver_device_tokens', 'INSERT') AS can_insert
    `);
    expect(insertPrivs[0].can_insert).toBe(false);

    // Verify RPC execute privileges: authenticated must not be able to call the RPCs.
    const { rows: regFnPriv } = await admin!.query(`
      SELECT has_function_privilege(
        'authenticated',
        'public.driver_register_device_token_atomic(uuid,uuid,uuid,text,text,text,text,bigint)',
        'EXECUTE'
      ) AS can_exec
    `);
    expect(regFnPriv[0].can_exec).toBe(false);

    const { rows: unregFnPriv } = await admin!.query(`
      SELECT has_function_privilege(
        'authenticated',
        'public.driver_unregister_device_token_atomic(uuid,uuid,text,text,bigint)',
        'EXECUTE'
      ) AS can_exec
    `);
    expect(unregFnPriv[0].can_exec).toBe(false);

    // RLS is enabled on the table (no authenticated policy exists, so even with
    // a GRANT the role would see no rows).
    const { rows: rlsRows } = await admin!.query(`
      SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.driver_device_tokens'::regclass
    `);
    expect(rlsRows[0].relrowsecurity).toBe(true);

    // service_role must be able to execute both RPCs.
    const { rows: svcReg } = await admin!.query(`
      SELECT has_function_privilege(
        'service_role',
        'public.driver_register_device_token_atomic(uuid,uuid,uuid,text,text,text,text,bigint)',
        'EXECUTE'
      ) AS can_exec
    `);
    expect(svcReg[0].can_exec).toBe(true);

    const { rows: svcUnreg } = await admin!.query(`
      SELECT has_function_privilege(
        'service_role',
        'public.driver_unregister_device_token_atomic(uuid,uuid,text,text,bigint)',
        'EXECUTE'
      ) AS can_exec
    `);
    expect(svcUnreg[0].can_exec).toBe(true);
  });
});
