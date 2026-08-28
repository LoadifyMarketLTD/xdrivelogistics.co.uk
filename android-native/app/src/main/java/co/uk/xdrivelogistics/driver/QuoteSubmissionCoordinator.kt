package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverSession
import java.util.concurrent.atomic.AtomicBoolean

internal data class RichQuoteInput(
    val amountText: String,
    val note: String,
    val collectWithinMinutes: Int? = null,
    val additionalExtrasText: String = "",
    val vehicleId: String? = null,
    val vehicleLabel: String? = null,
)

internal typealias QuoteSubmitFn = suspend (
    session: DriverSession,
    profile: DriverProfile,
    jobId: String,
    amount: Double,
    note: String,
    collectWithinMinutes: Int?,
    additionalExtrasGbp: Double,
    vehicleId: String?,
) -> Result<Unit>

internal sealed class QuoteSubmitOutcome {
    object AlreadyInFlight : QuoteSubmitOutcome()
    object NoSession : QuoteSubmitOutcome()
    object NoProfile : QuoteSubmitOutcome()
    data class ValidationFailure(val message: String) : QuoteSubmitOutcome()
    data class Success(
        val resolvedJobId: String,
        val amount: Double,
        val additionalExtrasGbp: Double,
        val collectWithinMinutes: Int?,
        val vehicleId: String?,
        val vehicleLabel: String?,
        val note: String,
    ) : QuoteSubmitOutcome()
    data class ApiFailure(
        val error: Throwable,
        val amount: Double,
        val additionalExtrasGbp: Double,
        val collectWithinMinutes: Int?,
        val vehicleId: String?,
        val vehicleLabel: String?,
        val note: String,
    ) : QuoteSubmitOutcome()
}

internal class QuoteSubmissionCoordinator(private val submitFn: QuoteSubmitFn) {
    private val inFlight = AtomicBoolean(false)

    suspend fun submit(
        quoteJobId: String?,
        jobs: List<DriverJob>,
        input: RichQuoteInput,
        session: DriverSession?,
        profile: DriverProfile?,
    ): QuoteSubmitOutcome {
        if (!inFlight.compareAndSet(false, true)) return QuoteSubmitOutcome.AlreadyInFlight
        return try {
            val sess = session ?: return QuoteSubmitOutcome.NoSession
            val prof = profile ?: return QuoteSubmitOutcome.NoProfile
            val selectedJob = jobs.firstOrNull { it.id == quoteJobId }
                ?: return QuoteSubmitOutcome.ValidationFailure("Select a posted job first.")
            if (selectedJob.status.lowercase() !in setOf("posted", "quoted")) {
                return QuoteSubmitOutcome.ValidationFailure("This job is no longer open for quotation.")
            }
            val amount = parseFinitePositiveAmount(input.amountText)
                ?: return QuoteSubmitOutcome.ValidationFailure("Enter a valid quote amount.")
            val extras = if (input.additionalExtrasText.isBlank()) 0.0 else parseNonNegativeAmount(input.additionalExtrasText)
                ?: return QuoteSubmitOutcome.ValidationFailure("Enter a valid extras amount.")
            if (extras > 1_000_000.0 || amount + extras > 1_000_000.0) {
                return QuoteSubmitOutcome.ValidationFailure("Quote total is too high.")
            }
            if (input.collectWithinMinutes != null && input.collectWithinMinutes !in 5..240) {
                return QuoteSubmitOutcome.ValidationFailure("Collection time must be between 5 and 240 minutes.")
            }
            val vehicleId = input.vehicleId?.trim()?.takeIf { it.isNotBlank() }
            if (vehicleId != null && vehicleId != prof.vehicleId) {
                return QuoteSubmitOutcome.ValidationFailure("Select the vehicle currently assigned to your driver profile.")
            }
            val note = input.note.trim()
            if (note.length > 1_000) return QuoteSubmitOutcome.ValidationFailure("Quote message is too long.")

            submitFn(sess, prof, selectedJob.id, amount, note, input.collectWithinMinutes, extras, vehicleId)
                .fold(
                    onSuccess = {
                        QuoteSubmitOutcome.Success(
                            selectedJob.id, amount, extras, input.collectWithinMinutes, vehicleId, input.vehicleLabel, note,
                        )
                    },
                    onFailure = {
                        QuoteSubmitOutcome.ApiFailure(
                            it, amount, extras, input.collectWithinMinutes, vehicleId, input.vehicleLabel, note,
                        )
                    },
                )
        } finally {
            inFlight.set(false)
        }
    }

    /** Compatibility overload for historical unit tests while production UI migrates. */
    suspend fun submit(
        quoteJobId: String?,
        jobs: List<DriverJob>,
        amountText: String,
        note: String,
        session: DriverSession?,
        profile: DriverProfile?,
    ): QuoteSubmitOutcome = submit(
        quoteJobId = quoteJobId,
        jobs = jobs,
        input = RichQuoteInput(amountText = amountText, note = note),
        session = session,
        profile = profile,
    )
}

private fun parseNonNegativeAmount(raw: String): Double? {
    val normalized = raw.trim().replace(",", "").removePrefix("£").trim()
    val value = normalized.toDoubleOrNull() ?: return null
    return value.takeIf { it.isFinite() && it >= 0.0 }
}
