package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverSession
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [QuoteSubmissionCoordinator].
 *
 * The coordinator is the production code used by [DriverViewModel.submitQuoteForSelectedJob];
 * these tests therefore prove the behaviour of the real submission path, not a stand-in.
 *
 * Required coverage (per review comment 5143497370):
 * 1. Job A selected, then explicit quote context changed to job B → exactly one API call for B.
 * 2. Two submit calls while the first is in-flight → exactly one API call.
 * 3. Success resets the in-flight guard (a subsequent submit is accepted).
 * 4. Failure resets the in-flight guard and returns [QuoteSubmitOutcome.ApiFailure].
 * 5. Guard conditions (missing session, profile, job; non-posted job; invalid amount) → zero API calls.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class QuoteSubmissionCoordinatorTest {

    // -----------------------------------------------------------------------
    // Test fixtures
    // -----------------------------------------------------------------------

    private val session = DriverSession(
        accessToken = "test-token",
        refreshToken = "test-refresh",
        userId = "user-1",
        email = "driver@xdrive.co.uk",
    )

    private val profile = DriverProfile(
        driverId = "driver-1",
        companyId = "company-1",
    )

    private fun postedJob(id: String) = DriverJob(
        id = id,
        status = "posted",
        currentStatus = "posted",
        pickupLocation = "Leeds LS1",
        deliveryLocation = "London EC1",
        pickupDatetime = null,
        deliveryDatetime = null,
        clientName = "Acme Freight",
        clientPhone = "",
        vehicleType = "Luton Van",
        cargoType = "Pallets",
        budgetAmount = null,
        loadDetails = "",
    )

    private fun allocatedJob(id: String) = postedJob(id).copy(
        status = "allocated",
        currentStatus = "allocated",
    )

    // -----------------------------------------------------------------------
    // Required test 1 — job B submitted, not previously-selected job A
    // -----------------------------------------------------------------------

    @Test
    fun `submits to explicitly opened job B not previously cached job A`() = runTest {
        val calls = mutableListOf<Pair<String, Double>>()
        val coordinator = QuoteSubmissionCoordinator { _, _, jobId, amount, _ ->
            calls.add(jobId to amount)
            Result.success(Unit)
        }
        val jobs = listOf(postedJob("job-a"), postedJob("job-b"))

        val outcome = coordinator.submit(
            quoteJobId = "job-b",
            jobs = jobs,
            amountText = "150.00",
            note = "",
            session = session,
            profile = profile,
        )

        assertEquals(1, calls.size)
        assertEquals("job-b", calls[0].first)
        assertEquals(150.0, calls[0].second, 0.001)
        assertTrue("Expected Success but got $outcome", outcome is QuoteSubmitOutcome.Success)
        assertEquals("job-b", (outcome as QuoteSubmitOutcome.Success).resolvedJobId)
    }

    // -----------------------------------------------------------------------
    // Required test 2 — second concurrent submit is dropped
    // -----------------------------------------------------------------------

    @Test
    fun `second concurrent submit is dropped while first is in-flight`() = runTest {
        var callCount = 0
        val gate = kotlinx.coroutines.CompletableDeferred<Unit>()
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ ->
            callCount++
            gate.await()          // suspend until gate is opened
            Result.success(Unit)
        }
        val jobs = listOf(postedJob("job-a"))

        // Launch first submit in the background (will suspend inside the API stub)
        val first = launch {
            coordinator.submit("job-a", jobs, "100.00", "", session, profile)
        }
        // Let the first coroutine enter the API call
        yield()

        // Second submit must be dropped immediately without an API call
        val outcome2 = coordinator.submit("job-a", jobs, "100.00", "", session, profile)

        assertEquals(QuoteSubmitOutcome.AlreadyInFlight, outcome2)
        assertEquals(1, callCount)

        // Unblock the first submit and wait for it to finish
        gate.complete(Unit)
        first.join()
    }

    // -----------------------------------------------------------------------
    // Required test 3 — success resets the guard
    // -----------------------------------------------------------------------

    @Test
    fun `after success a subsequent submit is accepted`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ ->
            callCount++
            Result.success(Unit)
        }
        val jobs = listOf(postedJob("job-a"))

        coordinator.submit("job-a", jobs, "100.00", "", session, profile)
        val outcome2 = coordinator.submit("job-a", jobs, "100.00", "", session, profile)

        assertEquals(2, callCount)
        assertTrue("Expected Success but got $outcome2", outcome2 is QuoteSubmitOutcome.Success)
    }

    // -----------------------------------------------------------------------
    // Required test 4 — failure resets the guard and surfaces error
    // -----------------------------------------------------------------------

    @Test
    fun `failure resets in-flight guard and returns ApiFailure`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ ->
            callCount++
            Result.failure(RuntimeException("Network timeout"))
        }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-a", jobs, "100.00", "", session, profile)

        assertTrue("Expected ApiFailure but got $outcome", outcome is QuoteSubmitOutcome.ApiFailure)
        assertEquals("Network timeout", (outcome as QuoteSubmitOutcome.ApiFailure).error.message)

        // Guard must be reset; a new submit should reach the API again
        val outcome2 = coordinator.submit("job-a", jobs, "100.00", "", session, profile)
        assertEquals(2, callCount)
        assertFalse("Should not be AlreadyInFlight", outcome2 is QuoteSubmitOutcome.AlreadyInFlight)
    }

    // -----------------------------------------------------------------------
    // Required test 5 — guard conditions produce zero API calls
    // -----------------------------------------------------------------------

    @Test
    fun `null session yields NoSession with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-a", jobs, "100.00", "", session = null, profile = profile)

        assertEquals(QuoteSubmitOutcome.NoSession, outcome)
        assertEquals(0, callCount)
    }

    @Test
    fun `null profile yields NoProfile with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-a", jobs, "100.00", "", session = session, profile = null)

        assertEquals(QuoteSubmitOutcome.NoProfile, outcome)
        assertEquals(0, callCount)
    }

    @Test
    fun `missing job yields ValidationFailure NO_JOB_SELECTED with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-missing", jobs, "100.00", "", session, profile)

        assertTrue(outcome is QuoteSubmitOutcome.ValidationFailure)
        assertEquals(
            QuoteValidationResult.NO_JOB_SELECTED,
            (outcome as QuoteSubmitOutcome.ValidationFailure).result,
        )
        assertEquals(0, callCount)
    }

    @Test
    fun `non-posted job yields ValidationFailure JOB_NOT_POSTED with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(allocatedJob("job-alloc"))

        val outcome = coordinator.submit("job-alloc", jobs, "100.00", "", session, profile)

        assertTrue(outcome is QuoteSubmitOutcome.ValidationFailure)
        assertEquals(
            QuoteValidationResult.JOB_NOT_POSTED,
            (outcome as QuoteSubmitOutcome.ValidationFailure).result,
        )
        assertEquals(0, callCount)
    }

    @Test
    fun `zero amount yields ValidationFailure INVALID_AMOUNT with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-a", jobs, "0", "", session, profile)

        assertTrue(outcome is QuoteSubmitOutcome.ValidationFailure)
        assertEquals(
            QuoteValidationResult.INVALID_AMOUNT,
            (outcome as QuoteSubmitOutcome.ValidationFailure).result,
        )
        assertEquals(0, callCount)
    }

    @Test
    fun `negative amount yields ValidationFailure INVALID_AMOUNT with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-a", jobs, "-50.00", "", session, profile)

        assertTrue(outcome is QuoteSubmitOutcome.ValidationFailure)
        assertEquals(
            QuoteValidationResult.INVALID_AMOUNT,
            (outcome as QuoteSubmitOutcome.ValidationFailure).result,
        )
        assertEquals(0, callCount)
    }

    @Test
    fun `non-numeric amount yields ValidationFailure INVALID_AMOUNT with zero API calls`() = runTest {
        var callCount = 0
        val coordinator = QuoteSubmissionCoordinator { _, _, _, _, _ -> callCount++; Result.success(Unit) }
        val jobs = listOf(postedJob("job-a"))

        val outcome = coordinator.submit("job-a", jobs, "abc", "", session, profile)

        assertTrue(outcome is QuoteSubmitOutcome.ValidationFailure)
        assertEquals(
            QuoteValidationResult.INVALID_AMOUNT,
            (outcome as QuoteSubmitOutcome.ValidationFailure).result,
        )
        assertEquals(0, callCount)
    }

    // -----------------------------------------------------------------------
    // Additional: API is called with the correct session/profile/amount
    // -----------------------------------------------------------------------

    @Test
    fun `correct session profile and amount are forwarded to the API`() = runTest {
        var capturedUserId: String? = null
        var capturedDriverId: String? = null
        var capturedAmount: Double? = null
        val coordinator = QuoteSubmissionCoordinator { sess, prof, _, amount, _ ->
            capturedUserId = sess.userId
            capturedDriverId = prof.driverId
            capturedAmount = amount
            Result.success(Unit)
        }
        val jobs = listOf(postedJob("job-a"))

        coordinator.submit("job-a", jobs, "275.50", "Handle with care", session, profile)

        assertEquals("user-1", capturedUserId)
        assertEquals("driver-1", capturedDriverId)
        assertEquals(275.5, capturedAmount!!, 0.001)
    }
}
