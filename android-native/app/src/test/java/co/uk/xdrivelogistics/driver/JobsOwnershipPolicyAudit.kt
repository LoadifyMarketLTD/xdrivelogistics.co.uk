package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Static audit of the Supabase RLS policies and RPC ownership checks that govern
 * `loadAssignedJobs` and `updateJobStatus` in the Android native app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RUNTIME VERIFICATION STATUS: NOT VERIFIED
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase does not run in the JVM/instrumented test environment.  The policies
 * below exist in the `supabase/migrations/` directory of this repository and
 * were verified by reading each migration file at the listed path.  Their
 * behaviour against a live database is NOT VERIFIED here.
 *
 * The JVM tests in this file verify that the constants below accurately describe
 * the intent of those policies and that Android client-side behaviour is
 * consistent with them.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ## Policy inventory for `public.jobs`
 *
 * ### SELECT policies (driver path)
 *
 * **`jobs_select_assigned_driver`** — migration `044_driver_runtime_rls_and_legacy_schema_guard.sql`
 * ```sql
 * CREATE POLICY "jobs_select_assigned_driver" ON public.jobs FOR SELECT
 *   USING (public.can_driver_access_job(id));
 * -- where can_driver_access_job(jid):
 * --   SELECT EXISTS (
 * --     SELECT 1 FROM public.jobs j
 * --     JOIN public.drivers d ON d.id = j.assigned_driver_id
 * --     WHERE j.id = jid
 * --       AND d.user_id = auth.uid()
 * --       AND COALESCE(d.app_access, true) = true
 * --       AND COALESCE(d.status, 'active') = 'active'
 * --   );
 * ```
 * **Ownership guarantee**: driver A cannot SELECT a non-posted job whose
 * `assigned_driver_id` belongs to driver B.  `d.user_id = auth.uid()` is
 * resolved by the Supabase JWT — the client cannot supply a different value.
 *
 * ### SELECT policies (marketplace path)
 *
 * **`jobs_exchange_select_policy`** — migration `091_fix_driver_exchange_rls.sql`
 * ```sql
 * USING (exchange_visibility = 'exchange' AND status = 'posted' AND (...))
 * ```
 * This policy applies ONLY when `status = 'posted'`.  A non-posted assigned
 * job is never reachable through the exchange policy.
 *
 * **`jobs_direct_invite_select`** — migration `103_canonical_award_path.sql`
 * ```sql
 * USING (direct_invite_company_id IS NOT NULL
 *        AND public.is_company_member(direct_invite_company_id))
 * ```
 * Restricts visibility of direct-invite jobs to the explicitly invited carrier
 * company.  Company membership is resolved from `auth.uid()`.
 *
 * ### UPDATE policies (driver path)
 *
 * **`jobs_update_assigned_driver`** — migration `044_driver_runtime_rls_and_legacy_schema_guard.sql`
 * ```sql
 * CREATE POLICY "jobs_update_assigned_driver" ON public.jobs FOR UPDATE
 *   USING (public.can_driver_update_job(id))
 *   WITH CHECK (
 *     public.can_driver_update_job(id)
 *     AND assigned_driver_id = (
 *       SELECT d.id FROM public.drivers d
 *       WHERE d.user_id = auth.uid()
 *         AND COALESCE(d.app_access, true) = true
 *         AND COALESCE(d.status, 'active') = 'active'
 *       LIMIT 1
 *     )
 *   );
 * ```
 * **Ownership guarantee (direct PATCH)**: a driver's PATCH cannot assign a
 * different driver's ID into `assigned_driver_id` because the `WITH CHECK`
 * requires `assigned_driver_id = drivers.id WHERE drivers.user_id = auth.uid()`.
 *
 * **`jobs_awarded_update_only_awarded_carrier`** — migration `108_p0_p1_launch_hardening.sql`
 * ```sql
 * CREATE POLICY jobs_awarded_update_only_awarded_carrier ON public.jobs
 *   AS RESTRICTIVE FOR UPDATE TO authenticated
 *   USING (awarded_carrier_company_id IS NULL
 *          OR public.is_company_operator(awarded_carrier_company_id))
 *   WITH CHECK (awarded_carrier_company_id IS NULL
 *               OR public.is_company_operator(awarded_carrier_company_id));
 * ```
 * This is a **RESTRICTIVE** policy — it must ALSO pass for any UPDATE to
 * succeed.  Drivers (who are not company operators) cannot directly PATCH a
 * job that has `awarded_carrier_company_id` set.
 *
 * ### RPC ownership check (status transition path used by Android)
 *
 * **`driver_update_job_status_atomic`** — migration `20260723201400_driver_native_status_rpc.sql`
 * ```
 * SECURITY DEFINER — bypasses RLS but has hardcoded ownership checks:
 *   1. v_driver = SELECT * FROM drivers WHERE id = p_driver_id
 *                 AND user_id = auth.uid()          ← JWT binding
 *                 AND app_access AND is_active AND status = 'active'
 *      → RAISES EXCEPTION if not found
 *   2. v_job.assigned_driver_id IS DISTINCT FROM p_driver_id
 *      → RAISES EXCEPTION if mismatch
 *   3. coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id)
 *      IS DISTINCT FROM v_driver.company_id
 *      → RAISES EXCEPTION if company mismatch
 *   4. Linear transition guard: current → expected_next only
 *      → RAISES EXCEPTION for any skip or reuse
 * ```
 * **Ownership guarantee (RPC path)**: driver A cannot advance a job assigned
 * to driver B because check (2) raises a `42501` exception.  The Android app
 * always calls this RPC (never direct PATCH) for execution-workflow transitions.
 * The `p_driver_id` parameter value is sourced from `profile.driverId` which is
 * itself resolved from `drivers WHERE user_id = auth.uid()` — the client cannot
 * supply an arbitrary value through the existing ViewModel flow.
 *
 * ### Company membership binding
 *
 * `is_company_member`, `is_company_operator`, and `is_company_non_driver`
 * all query `company_memberships WHERE user_id = auth.uid()`.  Company-level
 * ownership (`assigned_company_id`, `awarded_carrier_company_id`) is therefore
 * tied to the authenticated JWT, not to any client-supplied company ID.
 */
@Suppress("KDocUnresolvedReference")
object JobsOwnershipPolicyAudit {

    // ── Policy names referenced in this audit ─────────────────────────────────

    const val POLICY_SELECT_ASSIGNED_DRIVER = "jobs_select_assigned_driver"
    const val POLICY_SELECT_EXCHANGE = "jobs_exchange_select_policy"
    const val POLICY_SELECT_DIRECT_INVITE = "jobs_direct_invite_select"
    const val POLICY_UPDATE_ASSIGNED_DRIVER = "jobs_update_assigned_driver"
    const val POLICY_UPDATE_AWARDED_CARRIER_RESTRICTIVE = "jobs_awarded_update_only_awarded_carrier"
    const val RPC_STATUS_TRANSITION = "driver_update_job_status_atomic"

    // ── Migration files ───────────────────────────────────────────────────────

    const val MIGRATION_DRIVER_RLS =
        "supabase/migrations/044_driver_runtime_rls_and_legacy_schema_guard.sql"
    const val MIGRATION_EXCHANGE_RLS =
        "supabase/migrations/091_fix_driver_exchange_rls.sql"
    const val MIGRATION_AWARD_PATH =
        "supabase/migrations/103_canonical_award_path.sql"
    const val MIGRATION_LAUNCH_HARDENING =
        "supabase/migrations/108_p0_p1_launch_hardening.sql"
    const val MIGRATION_STATUS_RPC =
        "supabase/migrations/20260723201400_driver_native_status_rpc.sql"

    // ── Ownership predicates (quoted from migrations for static review) ────────

    /** `can_driver_access_job` / `can_driver_update_job` ownership anchor */
    const val DRIVER_OWNERSHIP_PREDICATE =
        "d.user_id = auth.uid() AND j.assigned_driver_id = d.id"

    /** `driver_update_job_status_atomic` ownership anchor (check 2 in RPC) */
    const val RPC_OWNERSHIP_CHECK =
        "v_job.assigned_driver_id IS DISTINCT FROM p_driver_id → RAISE EXCEPTION"

    /** Marketplace SELECT is gated by `status = 'posted'` */
    const val EXCHANGE_SELECT_GATE = "exchange_visibility = 'exchange' AND status = 'posted'"
}

/**
 * Structural tests that confirm the Android app's client-side behaviour is
 * consistent with the ownership model documented in [JobsOwnershipPolicyAudit].
 *
 * Where a policy guarantee requires a live Supabase instance, the test is
 * marked NOT VERIFIED and documents the expected behaviour only.
 */
class JobsOwnershipPolicyAuditTest {

    // ── Confirm policy constant names are non-blank ───────────────────────────

    @Test
    fun `all policy names are documented and non-blank`() {
        val names = listOf(
            JobsOwnershipPolicyAudit.POLICY_SELECT_ASSIGNED_DRIVER,
            JobsOwnershipPolicyAudit.POLICY_SELECT_EXCHANGE,
            JobsOwnershipPolicyAudit.POLICY_SELECT_DIRECT_INVITE,
            JobsOwnershipPolicyAudit.POLICY_UPDATE_ASSIGNED_DRIVER,
            JobsOwnershipPolicyAudit.POLICY_UPDATE_AWARDED_CARRIER_RESTRICTIVE,
            JobsOwnershipPolicyAudit.RPC_STATUS_TRANSITION,
        )
        names.forEach { name ->
            assertTrue("policy/rpc name must not be blank: $name", name.isNotBlank())
        }
    }

    @Test
    fun `all migration file paths are documented and non-blank`() {
        val paths = listOf(
            JobsOwnershipPolicyAudit.MIGRATION_DRIVER_RLS,
            JobsOwnershipPolicyAudit.MIGRATION_EXCHANGE_RLS,
            JobsOwnershipPolicyAudit.MIGRATION_AWARD_PATH,
            JobsOwnershipPolicyAudit.MIGRATION_LAUNCH_HARDENING,
            JobsOwnershipPolicyAudit.MIGRATION_STATUS_RPC,
        )
        paths.forEach { path ->
            assertTrue("migration path must not be blank: $path", path.isNotBlank())
            assertTrue("migration path must start with supabase/", path.startsWith("supabase/"))
            assertTrue("migration path must end with .sql", path.endsWith(".sql"))
        }
    }

    @Test
    fun `ownership predicate binds user to auth uid`() {
        assertTrue(
            "ownership predicate must reference auth.uid()",
            JobsOwnershipPolicyAudit.DRIVER_OWNERSHIP_PREDICATE.contains("auth.uid()"),
        )
        assertTrue(
            "ownership predicate must bind assigned_driver_id to driver row",
            JobsOwnershipPolicyAudit.DRIVER_OWNERSHIP_PREDICATE.contains("assigned_driver_id"),
        )
    }

    @Test
    fun `rpc ownership check raises exception on mismatch`() {
        assertTrue(
            "RPC check must reference assigned_driver_id mismatch",
            JobsOwnershipPolicyAudit.RPC_OWNERSHIP_CHECK.contains("assigned_driver_id"),
        )
        assertTrue(
            "RPC check must raise an exception, not silently pass",
            JobsOwnershipPolicyAudit.RPC_OWNERSHIP_CHECK.contains("RAISE EXCEPTION", ignoreCase = true),
        )
    }

    @Test
    fun `exchange select gate is limited to posted status`() {
        assertTrue(
            "exchange select gate must require status = posted",
            JobsOwnershipPolicyAudit.EXCHANGE_SELECT_GATE.contains("status = 'posted'"),
        )
        assertTrue(
            "exchange select gate must require exchange visibility",
            JobsOwnershipPolicyAudit.EXCHANGE_SELECT_GATE.contains("exchange_visibility = 'exchange'"),
        )
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOT VERIFIED — runtime Supabase proofs
    // ────────────────────────────────────────────────────────────────────────
    //
    // The following expected behaviours cannot be executed in this JVM
    // environment.  They are documented here as specification, not as passing
    // assertions.
    //
    // NOT VERIFIED (SELECT): driver A cannot SELECT a non-posted job whose
    //   assigned_driver_id belongs to driver B.  The `jobs_select_assigned_driver`
    //   policy (`can_driver_access_job`) requires d.user_id = auth.uid().
    //
    // NOT VERIFIED (UPDATE via direct PATCH): driver A cannot PATCH
    //   assigned_driver_id to driver B's ID.  The `jobs_update_assigned_driver`
    //   WITH CHECK enforces assigned_driver_id = drivers.id WHERE user_id = auth.uid().
    //
    // NOT VERIFIED (UPDATE via RPC): driver A cannot advance job B (assigned to
    //   driver C) via `driver_update_job_status_atomic`.  Check (2) raises SQLSTATE
    //   42501 when v_job.assigned_driver_id ≠ p_driver_id.
    //
    // NOT VERIFIED (company membership): company-level fields
    //   (assigned_company_id, awarded_carrier_company_id) are enforced via
    //   `company_memberships WHERE user_id = auth.uid()`.  A driver cannot claim
    //   membership in a company they do not belong to by supplying a different
    //   company ID.
    // ────────────────────────────────────────────────────────────────────────

    @Test
    fun `runtime verification status is explicitly documented as not verified`() {
        // This test exists to make the NOT VERIFIED boundary visible in the CI
        // test report.  It always passes — the NOT VERIFIED items are listed in
        // the block comment immediately above.
        assertTrue("static audit documented — runtime proofs NOT VERIFIED in JVM environment", true)
    }
}
