package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DriverJobLifecycleTest {
    @Test
    fun `canonical chain includes accepted and delivery transit`() {
        assertEquals("accepted", job("allocated").nextStatus())
        assertEquals("accepted", job("awarded").nextStatus())
        assertEquals("on_my_way_to_pickup", job("accepted").nextStatus())
        assertEquals("on_my_way_to_delivery", job("loaded").nextStatus())
        assertEquals("on_site_delivery", job("on_my_way_to_delivery").nextStatus())
    }

    @Test
    fun `posted job cannot be started directly`() {
        val posted = job("posted")
        assertEquals("", posted.nextStatus())
        assertFalse(posted.canMoveNext())
    }

    @Test
    fun `collection proof is required before loaded`() {
        val missing = job("on_site_pickup")
        assertFalse(missing.canMoveNext())
        assertTrue(missing.blockingRequirementFor()?.contains("collection photo") == true)

        val ready = job("on_site_pickup", collectionPhotoUrl = "proof/collection.jpg")
        assertTrue(ready.canMoveNext())
        assertNull(ready.blockingRequirementFor())
    }

    @Test
    fun `signed pod and recipient are required before delivered`() {
        val photoOnly = job(
            "on_site_delivery",
            deliveryPhotos = listOf("proof/delivery.jpg"),
        )
        assertFalse(photoOnly.canMoveNext())

        val complete = job(
            "on_site_delivery",
            deliveryPhotos = listOf("proof/delivery.jpg"),
            clientSignatureName = "Alex Recipient",
            deliverySignatureData = "signed-pod",
        )
        assertTrue(complete.canMoveNext())
    }

    @Test
    fun `legacy aliases normalize without skipping a step`() {
        assertEquals("on_my_way_to_delivery", job("on_route_delivery").driverStatusKey())
        assertEquals("on_site_delivery", job("arrived_delivery").driverStatusKey())
    }

    private fun job(
        status: String,
        collectionPhotoUrl: String? = null,
        deliveryPhotos: List<String> = emptyList(),
        clientSignatureName: String = "",
        deliverySignatureData: String? = null,
    ) = DriverJob(
        id = "job-1",
        status = status,
        currentStatus = status,
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
