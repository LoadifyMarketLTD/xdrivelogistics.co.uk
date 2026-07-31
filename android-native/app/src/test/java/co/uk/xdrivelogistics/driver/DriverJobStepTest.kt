package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies each driver job lifecycle step end-to-end.
 *
 * Task 3  – Awarded → Allocated → Accept Job
 * Task 4  – On My Way to Pickup
 * Task 5  – Arrived at Pickup
 * Task 6  – Collection Proof + Loaded
 * Task 7  – On My Way to Delivery
 * Task 8  – Arrived at Delivery
 * Task 9  – POD (recipient, signature, photos, Delivered)
 */
class DriverJobStepTest {

    // ── Task 3 – Awarded → Allocated → Accept Job ────────────────────────────

    @Test
    fun `task3 awarded job keeps awarded status key`() {
        assertEquals("awarded", job("awarded").driverStatusKey())
    }

    @Test
    fun `task3 allocated and awarded both advance to on_my_way`() {
        assertEquals("on_my_way", job("allocated").nextStatus())
        assertEquals("on_my_way", job("awarded").nextStatus())
    }

    @Test
    fun `task3 allocated and awarded can move next without any proof`() {
        assertTrue(job("allocated").canMoveNext())
        assertTrue(job("awarded").canMoveNext())
        assertNull(job("allocated").blockingRequirementFor())
        assertNull(job("awarded").blockingRequirementFor())
    }

    @Test
    fun `task3 accept job shows correct action label`() {
        assertEquals("On My Way to Collection", job("allocated").nextActionLabel())
        assertEquals("On My Way to Collection", job("awarded").nextActionLabel())
    }

    @Test
    fun `task3 posted job is blocked from acceptance`() {
        val posted = job("posted")
        assertTrue(posted.isPosted())
        assertFalse(posted.canMoveNext())
        assertEquals("", posted.nextStatus())
    }

    @Test
    fun `task3 allocated and awarded jobs are active`() {
        assertTrue(job("allocated").isActive())
        assertTrue(job("awarded").isActive())
    }

    @Test
    fun `task3 terminal statuses are not active`() {
        assertFalse(job("delivered").isActive())
        assertFalse(job("completed").isActive())
        assertFalse(job("cancelled").isActive())
        assertFalse(job("canceled").isActive())
        assertFalse(job("invoiced").isActive())
        assertFalse(job("paid").isActive())
    }

    @Test
    fun `task3 assigned and accepted aliases normalise to allocated`() {
        assertEquals("allocated", job("assigned").driverStatusKey())
        assertEquals("allocated", job("accepted").driverStatusKey())
    }

    @Test
    fun `task3 allocated status label is Allocated`() {
        assertEquals("Allocated", job("allocated").statusLabel())
    }

    @Test
    fun `task3 awarded status label is Awarded`() {
        assertEquals("Awarded", job("awarded").statusLabel())
    }

    // ── Task 4 – On My Way to Pickup ─────────────────────────────────────────

    @Test
    fun `task4 on_my_way moves to on_site_pickup`() {
        assertEquals("on_site_pickup", job("on_my_way").nextStatus())
    }

    @Test
    fun `task4 on_my_way is in progress`() {
        assertTrue(job("on_my_way").isInProgress())
    }

    @Test
    fun `task4 on_my_way has correct status label`() {
        assertEquals("On My Way to Collection", job("on_my_way").statusLabel())
    }

    @Test
    fun `task4 on_my_way action label is arrived at collection`() {
        assertEquals("Arrived at Collection", job("on_my_way").nextActionLabel())
    }

    @Test
    fun `task4 on_my_way has no blocking requirement`() {
        assertTrue(job("on_my_way").canMoveNext())
        assertNull(job("on_my_way").blockingRequirementFor())
    }

    // ── Task 5 – Arrived at Pickup ────────────────────────────────────────────

    @Test
    fun `task5 on_site_pickup has correct status label`() {
        assertEquals("Arrived at Collection", job("on_site_pickup").statusLabel())
    }

    @Test
    fun `task5 on_site_pickup moves to loaded`() {
        assertEquals("loaded", job("on_site_pickup").nextStatus())
    }

    @Test
    fun `task5 arrived_pickup alias normalises to on_site_pickup`() {
        assertEquals("on_site_pickup", job("arrived_pickup").driverStatusKey())
    }

    @Test
    fun `task5 on_site_pickup is in progress`() {
        assertTrue(job("on_site_pickup").isInProgress())
    }

    // ── Task 6 – Collection Proof + Loaded ────────────────────────────────────

    @Test
    fun `task6 on_site_pickup without proof blocks move next`() {
        assertFalse(job("on_site_pickup").canMoveNext())
        assertNotNull(job("on_site_pickup").blockingRequirementFor())
    }

    @Test
    fun `task6 blocking message mentions collection photo`() {
        assertTrue(
            job("on_site_pickup").blockingRequirementFor()?.contains("collection photo") == true
        )
    }

    @Test
    fun `task6 on_site_pickup with proof allows move next`() {
        val ready = job("on_site_pickup", collectionPhotoUrl = "proof/collection.jpg")
        assertTrue(ready.canMoveNext())
        assertNull(ready.blockingRequirementFor())
    }

    @Test
    fun `task6 hasCollectionProof reflects presence of url`() {
        assertFalse(job("on_site_pickup").hasCollectionProof())
        assertTrue(job("on_site_pickup", collectionPhotoUrl = "proof.jpg").hasCollectionProof())
    }

    @Test
    fun `task6 needsCollectionProof is true only when next step is loaded`() {
        assertTrue(job("on_site_pickup").needsCollectionProof())
        assertFalse(job("on_my_way").needsCollectionProof())
        assertFalse(job("loaded").needsCollectionProof())
        assertFalse(job("in_transit").needsCollectionProof())
    }

    @Test
    fun `task6 collected alias normalises to loaded`() {
        assertEquals("loaded", job("collected").driverStatusKey())
    }

    @Test
    fun `task6 loaded moves to in_transit`() {
        assertEquals("in_transit", job("loaded").nextStatus())
    }

    @Test
    fun `task6 loaded action label is on my way to delivery`() {
        assertEquals("On My Way to Delivery", job("loaded").nextActionLabel())
    }

    @Test
    fun `task6 loaded is in progress`() {
        assertTrue(job("loaded").isInProgress())
    }

    // ── Task 7 – On My Way to Delivery ────────────────────────────────────────

    @Test
    fun `task7 in_transit has correct status label`() {
        assertEquals("On My Way to Delivery", job("in_transit").statusLabel())
    }

    @Test
    fun `task7 loaded has correct status label`() {
        assertEquals("Loaded", job("loaded").statusLabel())
    }

    @Test
    fun `task7 on_route_delivery alias normalises to in_transit`() {
        assertEquals("in_transit", job("on_route_delivery").driverStatusKey())
    }

    @Test
    fun `task7 on_my_way_to_delivery alias normalises to in_transit`() {
        assertEquals("in_transit", job("on_my_way_to_delivery").driverStatusKey())
    }

    @Test
    fun `task7 in_transit is in progress`() {
        assertTrue(job("in_transit").isInProgress())
    }

    @Test
    fun `task7 in_transit has no blocking requirement`() {
        assertTrue(job("in_transit").canMoveNext())
        assertNull(job("in_transit").blockingRequirementFor())
    }

    // ── Task 8 – Arrived at Delivery ─────────────────────────────────────────

    @Test
    fun `task8 in_transit moves to on_site_delivery`() {
        assertEquals("on_site_delivery", job("in_transit").nextStatus())
    }

    @Test
    fun `task8 arrived_delivery alias normalises to on_site_delivery`() {
        assertEquals("on_site_delivery", job("arrived_delivery").driverStatusKey())
    }

    @Test
    fun `task8 on_site_delivery has correct status label`() {
        assertEquals("Arrived at Delivery", job("on_site_delivery").statusLabel())
    }

    @Test
    fun `task8 on_site_delivery is in progress`() {
        assertTrue(job("on_site_delivery").isInProgress())
    }

    @Test
    fun `task8 on_site_delivery action label is mark as delivered`() {
        assertEquals("Mark as Delivered", job("on_site_delivery").nextActionLabel())
    }

    // ── Task 9 – POD (recipient, signature, photos, Delivered) ───────────────

    @Test
    fun `task9 on_site_delivery without evidence blocks move`() {
        assertFalse(job("on_site_delivery").canMoveNext())
    }

    @Test
    fun `task9 delivery with photo only still blocked`() {
        val photoOnly = job("on_site_delivery", deliveryPhotos = listOf("delivery.jpg"))
        assertFalse(photoOnly.canMoveNext())
    }

    @Test
    fun `task9 delivery with photo and recipient but no signature still blocked`() {
        val partial = job(
            "on_site_delivery",
            deliveryPhotos = listOf("delivery.jpg"),
            clientSignatureName = "Alex",
        )
        assertFalse(partial.canMoveNext())
    }

    @Test
    fun `task9 pod photos also count as delivery evidence`() {
        val withPodPhoto = job("on_site_delivery", podPhotos = listOf("pod.jpg"))
        assertFalse(withPodPhoto.canMoveNext()) // still needs name + signature
        assertTrue(withPodPhoto.hasPod())
    }

    @Test
    fun `task9 complete pod enables delivered transition`() {
        val complete = job(
            "on_site_delivery",
            deliveryPhotos = listOf("delivery.jpg"),
            clientSignatureName = "Alex Recipient",
            deliverySignatureData = "signed-pod",
        )
        assertTrue(complete.canMoveNext())
        assertNull(complete.blockingRequirementFor())
    }

    @Test
    fun `task9 pod_required false bypasses evidence gate`() {
        val noPodRequired = job("on_site_delivery", podRequired = false)
        assertTrue(noPodRequired.canMoveNext())
        assertNull(noPodRequired.blockingRequirementFor())
    }

    @Test
    fun `task9 hasPod detects both delivery and pod photo lists`() {
        assertFalse(job("on_site_delivery").hasPod())
        assertTrue(job("on_site_delivery", deliveryPhotos = listOf("d.jpg")).hasPod())
        assertTrue(job("on_site_delivery", podPhotos = listOf("p.jpg")).hasPod())
    }

    @Test
    fun `task9 delivered status label is correct`() {
        assertEquals("Delivered (POD)", job("delivered").statusLabel())
    }

    @Test
    fun `task9 delivered job advances to completed`() {
        assertEquals("completed", job("delivered").nextStatus())
        assertTrue(job("delivered").canMoveNext())
    }

    @Test
    fun `task9 on_site_delivery moves to delivered`() {
        assertEquals("delivered", job("on_site_delivery").nextStatus())
    }

    @Test
    fun `task9 completed job has no further action`() {
        assertEquals("", job("completed").nextStatus())
        assertEquals("No further action", job("completed").nextActionLabel())
        assertFalse(job("completed").canMoveNext())
    }

    // ── route label sanity ────────────────────────────────────────────────────

    @Test
    fun `route label combines pickup and delivery locations`() {
        val j = job("on_my_way")
        assertEquals("Manchester -> London", j.routeLabel())
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun job(
        status: String,
        collectionPhotoUrl: String? = null,
        deliveryPhotos: List<String> = emptyList(),
        podPhotos: List<String> = emptyList(),
        clientSignatureName: String = "",
        deliverySignatureData: String? = null,
        podRequired: Boolean = true,
    ) = DriverJob(
        id = "job-step-test",
        status = status,
        currentStatus = status,
        pickupLocation = "Manchester",
        deliveryLocation = "London",
        pickupDatetime = null,
        deliveryDatetime = null,
        clientName = "Test Client",
        clientPhone = "",
        vehicleType = "Luton",
        cargoType = "Boxes",
        budgetAmount = null,
        loadDetails = "",
        collectionPhotoUrl = collectionPhotoUrl,
        deliveryPhotos = deliveryPhotos,
        podPhotos = podPhotos,
        clientSignatureName = clientSignatureName,
        deliverySignatureData = deliverySignatureData,
        podRequired = podRequired,
    )
}
