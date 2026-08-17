package co.uk.xdrivelogistics.driver

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.draw.clip
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.uk.xdrivelogistics.driver.data.DriverJob
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// Colour aliases — single source of truth is XDriveTheme.kt
private val LiveLoadsCardBackground = XDriveTheme.Canvas
private val LiveLoadsCardBorder = XDriveTheme.Border
private val LiveLoadsPrimary = XDriveTheme.TextPrimary
private val LiveLoadsSecondary = XDriveTheme.TextSecondary
private val LiveLoadsYellow = XDriveTheme.Yellow
private val LiveLoadsSuccess = XDriveTheme.Success
private val LiveLoadsDanger = XDriveTheme.Danger
private val LiveLoadsChip = XDriveTheme.Chip

internal enum class LiveLoadsBox { LIVE, PINNED, HIDDEN }

internal enum class LiveLoadPreferenceAction { PIN, HIDE, RESTORE }

internal data class LiveLoadsEmptyState(
    val title: String,
    val message: String,
)

internal fun liveLoadsEmptyState(box: LiveLoadsBox, activeDeliveryPostcode: String?): LiveLoadsEmptyState = when (box) {
    LiveLoadsBox.PINNED -> LiveLoadsEmptyState(
        title = "No pinned loads.",
        message = "Pin loads from Live to keep them ready for quick quoting.",
    )
    LiveLoadsBox.HIDDEN -> LiveLoadsEmptyState(
        title = "No hidden loads.",
        message = "Loads you hide will appear here so you can restore them later.",
    )
    LiveLoadsBox.LIVE -> LiveLoadsEmptyState(
        title = "No live loads.",
        message = if (activeDeliveryPostcode.isNullOrBlank()) {
            "Take a run first and the app will search around its delivery postcode."
        } else {
            "No posted pickup loads found within your selected radius of $activeDeliveryPostcode."
        },
    )
}

internal fun routeToLiveLoadAction(
    jobId: String,
    mode: ActionEntryMode,
    onOpenActionForJob: (String, ActionEntryMode) -> Unit,
) {
    onOpenActionForJob(jobId, mode)
}

internal fun openLiveLoadFromCard(
    jobId: String,
    onOpenActionForJob: (String, ActionEntryMode) -> Unit,
) = routeToLiveLoadAction(jobId, ActionEntryMode.DETAILS, onOpenActionForJob)

internal fun openLiveLoadQuoteFlow(
    jobId: String,
    onOpenActionForJob: (String, ActionEntryMode) -> Unit,
) = routeToLiveLoadAction(jobId, ActionEntryMode.QUOTE, onOpenActionForJob)

internal fun filterLiveLoadsByBox(
    jobs: List<DriverJob>,
    preferences: Map<String, String>,
    box: LiveLoadsBox,
): List<DriverJob> = jobs.filter { job ->
    when (box) {
        LiveLoadsBox.PINNED -> preferences[job.id] == "saved"
        LiveLoadsBox.HIDDEN -> preferences[job.id] == "deleted"
        LiveLoadsBox.LIVE -> preferences[job.id] !in setOf("saved", "deleted")
    }
}

internal fun liveLoadsCounts(
    jobs: List<DriverJob>,
    preferences: Map<String, String>,
): Triple<Int, Int, Int> {
    val live = filterLiveLoadsByBox(jobs, preferences, LiveLoadsBox.LIVE).size
    val pinned = filterLiveLoadsByBox(jobs, preferences, LiveLoadsBox.PINNED).size
    val hidden = filterLiveLoadsByBox(jobs, preferences, LiveLoadsBox.HIDDEN).size
    return Triple(live, pinned, hidden)
}

internal fun applyLiveLoadPreferenceAction(action: LiveLoadPreferenceAction): String? = when (action) {
    LiveLoadPreferenceAction.PIN -> "saved"
    LiveLoadPreferenceAction.HIDE -> "deleted"
    LiveLoadPreferenceAction.RESTORE -> null
}

// ---------------------------------------------------------------------------
// Quote submission validation helpers — pure functions, unit-testable on JVM
// ---------------------------------------------------------------------------

internal enum class QuoteValidationResult {
    OK,
    NO_JOB_SELECTED,
    JOB_NOT_POSTED,
    INVALID_AMOUNT,
}

/** Maps a validation failure to the user-facing error string shown in the quote form. */
internal fun QuoteValidationResult.toUserMessage(): String = when (this) {
    QuoteValidationResult.NO_JOB_SELECTED -> "Select an open Marketplace job first."
    QuoteValidationResult.JOB_NOT_POSTED -> "Only posted or quoted Marketplace jobs can be quoted."
    QuoteValidationResult.INVALID_AMOUNT -> "Enter a valid quote amount."
    QuoteValidationResult.OK -> ""
}

/**
 * Parses [text] as a finite, positive `Double`.
 *
 * Returns `null` for blank, non-numeric, zero, negative, infinite (`Infinity`, `+Infinity`) or
 * `NaN` values. Both `QuoteBox` composables use this function for their button-enabled check, and
 * [validateQuoteSubmission] uses it for the production validation path, so the rule is identical
 * across UI and coordinator.
 */
internal fun parseFinitePositiveAmount(text: String): Double? {
    val d = text.trim().toDoubleOrNull() ?: return null
    return if (d.isFinite() && d > 0.0) d else null
}

/** Validates the inputs that must be satisfied before a quote can be submitted. */
internal fun validateQuoteSubmission(
    quoteJobId: String?,
    jobs: List<DriverJob>,
    amountText: String,
): QuoteValidationResult {
    val job = jobs.firstOrNull { it.id == quoteJobId }
        ?: return QuoteValidationResult.NO_JOB_SELECTED
    if (job.status.lowercase() !in setOf("posted", "quoted")) return QuoteValidationResult.JOB_NOT_POSTED
    if (parseFinitePositiveAmount(amountText) == null) return QuoteValidationResult.INVALID_AMOUNT
    return QuoteValidationResult.OK
}

/**
 * Returns the job ID that would be submitted for a quote given the current state.
 * The job ID is read from the explicitly opened quote context, not from a generic
 * "last selected job" fallback, so the result is always tied to the job the driver
 * tapped Quote on.
 */
internal fun resolveQuoteJobId(quoteJobId: String?, jobs: List<DriverJob>): String? =
    jobs.firstOrNull { it.id == quoteJobId }?.id

internal data class LiveLoadCardData(
    val companyName: String,
    val reference: String,
    val vehicleType: String,
    val pickupLine: String,
    val pickupTime: String,
    val deliveryLine: String,
    val deliveryTime: String,
    val freightSummary: String,
)

internal fun DriverJob.toLiveLoadCardData(): LiveLoadCardData {
    val details = loadDetails.toJsonObjectOrNull()
    val company = clientName.takeIf { it.isNotBlank() } ?: "XDrive Marketplace"
    val ref = details.string("public_reference")
        ?: details.string("job_reference")
        ?: details.string("reference")
        ?: id.take(8).uppercase().ifBlank { "TBC" }
    val pallets = details.string("pallets")
        ?.takeIf { it.isNotBlank() && !it.equals("0", ignoreCase = true) }
        ?.let { "$it pallets" }
    val weight = details.string("weight")?.formatWeightLabel()
    val specialRequirements = details.string("special_requirements")
        ?: details.string("requirements")
    val summary = listOfNotNull(
        cargoType.takeIf { it.isNotBlank() },
        pallets,
        weight,
        specialRequirements?.takeIf { it.isNotBlank() }?.let { "Req: $it" },
    ).ifEmpty {
        listOf("Freight details pending")
    }.joinToString(" • ")
    return LiveLoadCardData(
        companyName = company,
        reference = ref,
        vehicleType = vehicleType.takeIf { it.isNotBlank() }
            ?: details.string("vehicle_type")
            ?: "Vehicle TBC",
        pickupLine = pickupLocation.takeIf { it.isNotBlank() }
            ?: pickupPostcode.takeIf { it.isNotBlank() }
            ?: "Collection TBC",
        pickupTime = pickupDatetime.formatLiveLoadsTime(),
        deliveryLine = deliveryLocation.takeIf { it.isNotBlank() }
            ?: deliveryPostcode.takeIf { it.isNotBlank() }
            ?: "Delivery TBC",
        deliveryTime = deliveryDatetime.formatLiveLoadsTime(),
        freightSummary = summary,
    )
}

private fun String?.formatLiveLoadsTime(): String {
    if (this.isNullOrBlank()) return "TBC"
    return runCatching {
        OffsetDateTime.parse(this).atZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("dd MMM HH:mm", Locale.UK))
    }.getOrElse { this }
}

private fun String.toJsonObjectOrNull(): JsonObject {
    if (isBlank()) return JsonObject()
    return runCatching { JsonParser.parseString(this).asJsonObject }.getOrDefault(JsonObject())
}

private fun JsonObject.string(name: String): String? {
    val value: JsonElement = get(name) ?: return null
    if (value.isJsonNull) return null
    return runCatching { value.asString }.getOrNull()
}

@Composable
internal fun LiveLoadCard(
    job: DriverJob,
    preferenceState: String?,
    activeDeliveryPostcode: String?,
    onOpenDetails: () -> Unit,
    onQuote: () -> Unit,
    onPreferenceAction: (LiveLoadPreferenceAction) -> Unit,
) {
    val card = job.toLiveLoadCardData()
    val currentBox = when (preferenceState) {
        "saved" -> LiveLoadsBox.PINNED
        "deleted" -> LiveLoadsBox.HIDDEN
        else -> LiveLoadsBox.LIVE
    }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenDetails),
        border = BorderStroke(1.dp, LiveLoadsCardBorder),
        colors = CardDefaults.cardColors(containerColor = LiveLoadsCardBackground),
        shape = RoundedCornerShape(4.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(LiveLoadsChip)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = card.companyName,
                    color = LiveLoadsPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = card.reference,
                    color = LiveLoadsSecondary,
                    fontSize = 10.sp,
                    maxLines = 1,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                LiveLoadFact(
                    label = "From",
                    primary = card.pickupLine,
                    secondary = card.pickupTime,
                    modifier = Modifier.weight(1.55f),
                )
                LiveLoadFact(
                    label = "To",
                    primary = card.deliveryLine,
                    secondary = card.deliveryTime,
                    modifier = Modifier.weight(1.55f),
                )
                LiveLoadFact(
                    label = "Vehicle",
                    primary = card.vehicleType,
                    secondary = card.freightSummary,
                    modifier = Modifier.weight(.75f),
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(LiveLoadsChip)
                    .padding(horizontal = 8.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (activeDeliveryPostcode?.isNotBlank() == true) {
                    Text(
                        text = "Near $activeDeliveryPostcode",
                        color = LiveLoadsSecondary,
                        fontSize = 10.sp,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                } else {
                    Box(modifier = Modifier.weight(1f))
                }

                when (currentBox) {
                    LiveLoadsBox.LIVE -> {
                        CompactLiveLoadsButton("Pin") { onPreferenceAction(LiveLoadPreferenceAction.PIN) }
                        CompactLiveLoadsButton("Hide") { onPreferenceAction(LiveLoadPreferenceAction.HIDE) }
                    }
                    LiveLoadsBox.PINNED,
                    LiveLoadsBox.HIDDEN -> CompactLiveLoadsButton("Restore") { onPreferenceAction(LiveLoadPreferenceAction.RESTORE) }
                }
                CompactLiveLoadsButton("Details", onOpenDetails)
                Button(
                    onClick = onQuote,
                    modifier = Modifier.height(28.dp),
                    shape = RoundedCornerShape(4.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = LiveLoadsSuccess),
                ) {
                    Text("Quote", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun LiveLoadFact(
    label: String,
    primary: String,
    secondary: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .heightIn(min = 56.dp)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, color = LiveLoadsSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text(primary, color = LiveLoadsPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(secondary, color = LiveLoadsSecondary, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun CompactLiveLoadsButton(label: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.height(28.dp),
        shape = RoundedCornerShape(4.dp),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
        border = BorderStroke(1.dp, LiveLoadsCardBorder),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = LiveLoadsPrimary),
    ) {
        Text(label, fontSize = 11.sp)
    }
}

@Preview(showBackground = true, widthDp = 900)
@Composable
private fun LiveLoadCardPreview() {
    LiveLoadCard(
        job = DriverJob(
            id = "job-preview-12345678",
            status = "posted",
            currentStatus = "posted",
            pickupLocation = "Blackburn BB1",
            deliveryLocation = "Birmingham B1",
            pickupDatetime = "2026-08-17T08:00:00Z",
            deliveryDatetime = "2026-08-17T11:00:00Z",
            clientName = "XDrive Logistics",
            clientPhone = "",
            vehicleType = "Luton Tail Lift",
            cargoType = "Palletised freight",
            budgetAmount = 450.0,
            loadDetails = "{}",
        ),
        preferenceState = null,
        activeDeliveryPostcode = "BB1",
        onOpenDetails = {},
        onQuote = {},
        onPreferenceAction = {},
    )
}
