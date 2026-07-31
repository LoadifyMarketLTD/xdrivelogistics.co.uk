package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * JVM tests for [preflightStatusUpdateRejection].
 *
 * These tests verify the Android client-side pre-flight ownership and eligibility
 * checks that execute before the API is called.  Server-side enforcement
 * (`jobs_select_assigned_driver` RLS and `driver_update_job_status_atomic` RPC)
 * is documented in [JobsOwnershipPolicyAudit] with explicit NOT VERIFIED markers.
 */
class JobOwnershipGuardTest {

    // ── posted job guard ──────────────────────────────────────────────────────

    @Test
    fun `posted job is rejected before any API call`() {
        val rejection = preflightStatusUpdateRejection(job("posted"), "on_my_way")
        assertNotNull("posted job must be rejected", rejection)
        assertTrue(
            "rejection message must explain quoting requirement",
            rejection!!.contains("quote", ignoreCase = true),
        )
    }

    @Test
    fun `job with legacy status posted is rejected`() {
        // currentStatus blank, status = "posted"
        val j = job("posted", currentStatus = "")
        assertNotNull(preflightStatusUpdateRejection(j, "on_my_way"))
    }

    // ── valid allocated / awarded transitions ─────────────────────────────────

    @Test
    fun `allocated job accepting on_my_way passes pre-flight`() {
        assertNull(preflightStatusUpdateRejection(job("allocated"), "on_my_way"))
    }

    @Test
    fun `awarded job accepting on_my_way passes pre-flight`() {
        assertNull(preflightStatusUpdateRejection(job("awarded"), "on_my_way"))
    }

    @Test
    fun `assigned alias normalises and passes pre-flight for on_my_way`() {
        // "assigned" is a legacy alias for "allocated"
        assertNull(preflightStatusUpdateRejection(job("assigned"), "on_my_way"))
    }

    @Test
    fun `accepted alias normalises and passes pre-flight for on_my_way`() {
        assertNull(preflightStatusUpdateRejection(job("accepted"), "on_my_way"))
    }

    // ── invalid transition guard ──────────────────────────────────────────────

    @Test
    fun `skipping a step is rejected`() {
        val rejection = preflightStatusUpdateRejection(job("allocated"), "loaded")
        assertNotNull("skipped step must be rejected", rejection)
        assertTrue(rejection!!.contains("cannot move", ignoreCase = true))
    }

    @Test
    fun `going backwards is rejected`() {
        val rejection = preflightStatusUpdateRejection(job("on_my_way"), "on_my_way")
        assertNotNull("backward/same-step must be rejected", rejection)
    }

    @Test
    fun `blank current status cannot start workflow`() {
        val j = job("", currentStatus = "")
        assertNotNull(preflightStatusUpdateRejection(j, "on_my_way"))
    }

    @Test
    fun `unrecognised status cannot start workflow`() {
        assertNotNull(preflightStatusUpdateRejection(job("future_unknown_status"), "on_my_way"))
    }

    // ── blocking proof requirement guards ─────────────────────────────────────

    @Test
    fun `on_site_pickup without collection photo is rejected`() {
        val j = job("on_site_pickup") // no collectionPhotoUrl
        val rejection = preflightStatusUpdateRejection(j, "loaded")
        assertNotNull("missing collection photo must be rejected", rejection)
        assertTrue(rejection!!.contains("collection photo", ignoreCase = true))
    }

    @Test
    fun `on_site_pickup with collection photo passes pre-flight`() {
        val j = job("on_site_pickup", collectionPhotoUrl = "proof/photo.jpg")
        assertNull(preflightStatusUpdateRejection(j, "loaded"))
    }

    @Test
    fun `on_site_delivery without pod signature is rejected`() {
        val j = job(
            "on_site_delivery",
            deliveryPhotos = listOf("proof/delivery.jpg"),
            // no clientSignatureName or deliverySignatureData
        )
        assertNotNull(preflightStatusUpdateRejection(j, "delivered"))
    }

    @Test
    fun `on_site_delivery with full pod passes pre-flight`() {
        val j = job(
            "on_site_delivery",
            deliveryPhotos = listOf("proof/delivery.jpg"),
            clientSignatureName = "Alex Recipient",
            deliverySignatureData = "signed-pod",
        )
        assertNull(preflightStatusUpdateRejection(j, "delivered"))
    }

    // ── full canonical chain ──────────────────────────────────────────────────

    @Test
    fun `full canonical chain passes pre-flight at each step`() {
        assertNull(preflightStatusUpdateRejection(job("allocated"), "on_my_way"))
        assertNull(preflightStatusUpdateRejection(job("on_my_way"), "on_site_pickup"))
        assertNull(
            preflightStatusUpdateRejection(
                job("on_site_pickup", collectionPhotoUrl = "proof.jpg"),
                "loaded",
            ),
        )
        assertNull(preflightStatusUpdateRejection(job("loaded"), "in_transit"))
        assertNull(preflightStatusUpdateRejection(job("in_transit"), "on_site_delivery"))
        assertNull(
            preflightStatusUpdateRejection(
                job(
                    "on_site_delivery",
                    deliveryPhotos = listOf("d.jpg"),
                    clientSignatureName = "A",
                    deliverySignatureData = "sig",
                ),
                "delivered",
            ),
        )
        assertNull(preflightStatusUpdateRejection(job("delivered"), "completed"))
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun job(
        status: String,
        currentStatus: String = status,
        collectionPhotoUrl: String? = null,
        deliveryPhotos: List<String> = emptyList(),
        clientSignatureName: String = "",
        deliverySignatureData: String? = null,
    ) = DriverJob(
        id = "job-1",
        status = status,
        currentStatus = currentStatus,
        pickupLocation = "Blackburn",
        deliveryLocation = "London",
        pickupDatetime = null,
        deliveryDatetime = null,
        clientName = "Client",
        clientPhone = "",
        vehicleType = "Luton",
        cargoType = "Pallets",
        budgetAmount = null,
        loadDetails = "",
        collectionPhotoUrl = collectionPhotoUrl,
        deliveryPhotos = deliveryPhotos,
        clientSignatureName = clientSignatureName,
        deliverySignatureData = deliverySignatureData,
    )
}
