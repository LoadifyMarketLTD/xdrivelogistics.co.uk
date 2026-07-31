package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverInvoice
import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverReturnJourney
import co.uk.xdrivelogistics.driver.data.DriverSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies data models for the features covered by:
 *
 * Task 11 – Notifications / Deep Links
 * Task 14 – SmartPay / Invoices
 * Task 15 – Documents / Profile / Availability / Settings
 * Task 16 – Android API authentication & error handling
 */
class DriverModelTest {

    // ── Task 11 – Notifications ────────────────────────────────────────────────

    @Test
    fun `task11 unread notification has null readAt`() {
        val notification = DriverNotification(
            id = "n1",
            title = "Job Awarded",
            body = "Your quote was accepted.",
            type = "job_awarded",
            readAt = null,
            createdAt = "2024-01-01T10:00:00Z",
        )
        assertNull(notification.readAt)
    }

    @Test
    fun `task11 read notification has non-null readAt`() {
        val notification = DriverNotification(
            id = "n2",
            title = "Job Awarded",
            body = "Your quote was accepted.",
            type = "job_awarded",
            readAt = "2024-01-01T10:05:00Z",
            createdAt = "2024-01-01T10:00:00Z",
        )
        assertNotNull(notification.readAt)
    }

    @Test
    fun `task11 notification preserves title body and type`() {
        val notification = DriverNotification(
            id = "n3",
            title = "New Load Available",
            body = "A load from Manchester to London is available.",
            type = "live_load",
            readAt = null,
            createdAt = null,
        )
        assertEquals("New Load Available", notification.title)
        assertEquals("A load from Manchester to London is available.", notification.body)
        assertEquals("live_load", notification.type)
    }

    @Test
    fun `task11 notification with null createdAt is handled`() {
        val notification = DriverNotification(
            id = "n4",
            title = "Alert",
            body = "Body",
            type = "system",
            readAt = null,
            createdAt = null,
        )
        assertNull(notification.createdAt)
    }

    // ── Task 14 – SmartPay / Invoices ─────────────────────────────────────────

    @Test
    fun `task14 invoice model holds all payment details`() {
        val invoice = DriverInvoice(
            id = "inv-1",
            invoiceNumber = "INV-001",
            status = "pending",
            amount = 350.0,
            currency = "GBP",
            clientName = "Acme Ltd",
            dueDate = "2024-02-01",
        )
        assertEquals("INV-001", invoice.invoiceNumber)
        assertEquals(350.0, invoice.amount!!, 0.001)
        assertEquals("GBP", invoice.currency)
        assertEquals("pending", invoice.status)
        assertEquals("Acme Ltd", invoice.clientName)
        assertEquals("2024-02-01", invoice.dueDate)
    }

    @Test
    fun `task14 invoice with null amount is handled gracefully`() {
        val invoice = DriverInvoice(
            id = "inv-2",
            invoiceNumber = "INV-002",
            status = "paid",
            amount = null,
            currency = "GBP",
            clientName = "Test Ltd",
            dueDate = null,
        )
        assertNull(invoice.amount)
        assertNull(invoice.dueDate)
    }

    @Test
    fun `task14 invoice number is preserved exactly`() {
        val invoice = DriverInvoice(
            id = "inv-3",
            invoiceNumber = "XDR-20240101-001",
            status = "overdue",
            amount = 1250.50,
            currency = "GBP",
            clientName = "Big Cargo Co",
            dueDate = "2024-01-15",
        )
        assertEquals("XDR-20240101-001", invoice.invoiceNumber)
        assertEquals(1250.50, invoice.amount!!, 0.001)
    }

    // ── Task 15 – Documents / Profile / Availability / Settings ──────────────

    @Test
    fun `task15 driver document distinguishes driver and vehicle documents`() {
        val driverDoc = DriverDocument(
            id = "doc-1",
            docType = "driving_licence",
            status = "approved",
            createdAt = "2024-01-01T00:00:00Z",
            isVehicleDocument = false,
        )
        val vehicleDoc = DriverDocument(
            id = "doc-2",
            docType = "mot",
            status = "pending",
            createdAt = "2024-01-01T00:00:00Z",
            expiryDate = "2025-01-01",
            isVehicleDocument = true,
        )
        assertFalse(driverDoc.isVehicleDocument)
        assertTrue(vehicleDoc.isVehicleDocument)
        assertNull(driverDoc.expiryDate)
        assertEquals("2025-01-01", vehicleDoc.expiryDate)
    }

    @Test
    fun `task15 document status reflects review outcome`() {
        val approved = DriverDocument("d1", "insurance", "approved", null, isVehicleDocument = false)
        val rejected = DriverDocument("d2", "insurance", "rejected", null, isVehicleDocument = false)
        val pending = DriverDocument("d3", "insurance", "pending", null, isVehicleDocument = false)

        assertEquals("approved", approved.status)
        assertEquals("rejected", rejected.status)
        assertEquals("pending", pending.status)
    }

    @Test
    fun `task15 driver profile contains all required fields`() {
        val profile = DriverProfile(
            driverId = "drv-1",
            companyId = "cmp-1",
            vehicleId = "veh-1",
            displayName = "John Driver",
            email = "john@example.com",
            vehicleLabel = "Ford Transit - LWB Van",
            vehicleRegistration = "AB12 CDE",
        )
        assertEquals("drv-1", profile.driverId)
        assertEquals("cmp-1", profile.companyId)
        assertEquals("veh-1", profile.vehicleId)
        assertEquals("John Driver", profile.displayName)
        assertEquals("john@example.com", profile.email)
        assertEquals("Ford Transit - LWB Van", profile.vehicleLabel)
        assertEquals("AB12 CDE", profile.vehicleRegistration)
    }

    @Test
    fun `task15 driver profile with no vehicle has sensible defaults`() {
        val profile = DriverProfile(
            driverId = "drv-2",
            companyId = "cmp-1",
        )
        assertNull(profile.vehicleId)
        assertEquals("", profile.vehicleLabel)
        assertEquals("", profile.vehicleRegistration)
        assertEquals("", profile.displayName)
    }

    @Test
    fun `task15 return journey holds availability information`() {
        val journey = DriverReturnJourney(
            id = "rj-1",
            fromLocation = "Manchester",
            toLocation = "London",
            availableDate = "2024-03-01",
        )
        assertEquals("Manchester", journey.fromLocation)
        assertEquals("London", journey.toLocation)
        assertEquals("2024-03-01", journey.availableDate)
    }

    @Test
    fun `task15 return journey available date can be null`() {
        val journey = DriverReturnJourney(
            id = "rj-2",
            fromLocation = "Birmingham",
            toLocation = "Leeds",
            availableDate = null,
        )
        assertNull(journey.availableDate)
    }

    // ── Task 16 – Authentication & Error Handling ─────────────────────────────

    @Test
    fun `task16 session preserves all four fields`() {
        val session = DriverSession(
            accessToken = "access-abc123",
            refreshToken = "refresh-def456",
            userId = "user-789",
            email = "driver@xdrivelogistics.co.uk",
        )
        assertEquals("access-abc123", session.accessToken)
        assertEquals("refresh-def456", session.refreshToken)
        assertEquals("user-789", session.userId)
        assertEquals("driver@xdrivelogistics.co.uk", session.email)
    }

    @Test
    fun `task16 two sessions with different tokens are not equal`() {
        val sessionA = DriverSession("token-a", "refresh-a", "user-1", "a@example.com")
        val sessionB = DriverSession("token-b", "refresh-b", "user-1", "a@example.com")
        assertTrue(sessionA != sessionB)
    }

    @Test
    fun `task16 two sessions with same data are equal`() {
        val sessionA = DriverSession("token-x", "refresh-x", "user-x", "x@example.com")
        val sessionB = DriverSession("token-x", "refresh-x", "user-x", "x@example.com")
        assertEquals(sessionA, sessionB)
    }
}
