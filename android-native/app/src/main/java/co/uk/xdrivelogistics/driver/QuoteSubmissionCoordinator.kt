package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverSession
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Function type for the actual API call that submits a quote.
 * Decoupled from [ApiClient] so the coordinator can be tested without a live API.
 */
internal typealias QuoteSubmitFn = suspend (
    session: DriverSession,
    profile: DriverProfile,
    jobId: String,
    amount: Double,
    note: String,
) -> Result<Unit>

/** Result returned by [QuoteSubmissionCoordinator.submit]. */
internal sealed class QuoteSubmitOutcome {
    /** A previous submission is still in-flight; this call was dropped without an API call. */
    object AlreadyInFlight : QuoteSubmitOutcome()
    /** No active session was present; no API call was made. */
    object NoSession : QuoteSubmitOutcome()
    /** Driver profile was not loaded; no API call was made. */
    object NoProfile : QuoteSubmitOutcome()
    /** Input validation failed; no API call was made. */
    data class ValidationFailure(val result: QuoteValidationResult) : QuoteSubmitOutcome()
    /** The API call succeeded. [resolvedJobId] is the job that was actually quoted. */
    data class Success(val resolvedJobId: String) : QuoteSubmitOutcome()
    /** The API call failed. */
    data class ApiFailure(val error: Throwable) : QuoteSubmitOutcome()
}

/**
 * Encapsulates quote-submission orchestration with:
 * - An atomic single-flight guard (at most one submission in progress at a time).
 * - Explicit job-ID capture at call time, never re-read inside the coroutine.
 * - Delegation to [validateQuoteSubmission] and [resolveQuoteJobId] from LiveLoadsComponents.
 *
 * The injectable [submitFn] makes this unit-testable without Robolectric or a live API.
 * Production code passes `api::submitJobQuote`; tests pass a stub lambda.
 */
internal class QuoteSubmissionCoordinator(private val submitFn: QuoteSubmitFn) {

    private val inFlight = AtomicBoolean(false)

    /**
     * Attempt to submit a quote.
     *
     * Returns [QuoteSubmitOutcome.AlreadyInFlight] immediately if another submission is already
     * in progress — no API call is made and the guard is not re-set.
     *
     * @param quoteJobId The job ID explicitly opened for quoting (captured before coroutine launch).
     * @param jobs       Current live-loads list used for validation.
     * @param amountText Raw amount string entered in the UI.
     * @param note       Optional message to accompany the quote.
     * @param session    Active driver session; null yields [QuoteSubmitOutcome.NoSession].
     * @param profile    Active driver profile; null yields [QuoteSubmitOutcome.NoProfile].
     */
    suspend fun submit(
        quoteJobId: String?,
        jobs: List<DriverJob>,
        amountText: String,
        note: String,
        session: DriverSession?,
        profile: DriverProfile?,
    ): QuoteSubmitOutcome {
        // compareAndSet false->true is atomic; if it returns false the flag was already true.
        if (!inFlight.compareAndSet(false, true)) return QuoteSubmitOutcome.AlreadyInFlight
        return try {
            val sess = session ?: return QuoteSubmitOutcome.NoSession
            val prof = profile ?: return QuoteSubmitOutcome.NoProfile

            val validation = validateQuoteSubmission(quoteJobId, jobs, amountText)
            if (validation != QuoteValidationResult.OK) {
                return QuoteSubmitOutcome.ValidationFailure(validation)
            }

            // resolveQuoteJobId is non-null here because validateQuoteSubmission returned OK
            val resolvedJobId = resolveQuoteJobId(quoteJobId, jobs)!!
            val amount = amountText.trim().toDouble()

            submitFn(sess, prof, resolvedJobId, amount, note.trim())
                .fold(
                    onSuccess = { QuoteSubmitOutcome.Success(resolvedJobId) },
                    onFailure = { QuoteSubmitOutcome.ApiFailure(it) },
                )
        } finally {
            inFlight.set(false)
        }
    }
}
