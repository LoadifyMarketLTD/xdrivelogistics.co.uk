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

/** Validates the inputs that must be satisfied before a quote can be submitted. */
internal fun validateQuoteSubmission(
    quoteJobId: String?,
    jobs: List<DriverJob>,
    amountText: String,
): QuoteValidationResult {
    val job = jobs.firstOrNull { it.id == quoteJobId }
        ?: return QuoteValidationResult.NO_JOB_SELECTED
    if (job.status.lowercase() != "posted") return QuoteValidationResult.JOB_NOT_POSTED
    val amount = amountText.trim().toDoubleOrNull()
    if (amount == null || amount <= 0.0) return QuoteValidationResult.INVALID_AMOUNT
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
            ?: details.string("vehicle")
            ?: "Vehicle TBC",
        pickupLine = pickupLocation.ifBlank { "Pickup location TBC" },
        pickupTime = pickupDatetime.liveLoadsDateTime(),
        deliveryLine = deliveryLocation.ifBlank { "Delivery location TBC" },
        deliveryTime = deliveryDatetime.liveLoadsDateTime(),
        freightSummary = summary,
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun LiveLoadCard(
    job: DriverJob,
    selected: Boolean,
    onOpen: () -> Unit,
    onQuote: () -> Unit,
    onSave: (() -> Unit)? = null,
    onHide: (() -> Unit)? = null,
    onRestore: (() -> Unit)? = null,
    preferenceState: String? = null,
) {
    val data = job.toLiveLoadCardData()
    Card(
        colors = CardDefaults.cardColors(containerColor = LiveLoadsCardBackground),
        border = BorderStroke(1.dp, if (selected) LiveLoadsYellow else LiveLoadsCardBorder),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .width(34.dp)
                            .height(34.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(LiveLoadsYellow),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("X", color = Color(0xFF05070C), fontSize = 18.sp, fontWeight = FontWeight.Black)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            data.companyName,
                            color = LiveLoadsPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            data.reference,
                            color = LiveLoadsSecondary,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .widthIn(max = 130.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(LiveLoadsChip)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                ) {
                    Text(
                        data.vehicleType,
                        color = if (data.vehicleType.contains("TBC", ignoreCase = true)) LiveLoadsSecondary else LiveLoadsPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            LiveLoadRouteSection(data.pickupLine, data.pickupTime, data.deliveryLine, data.deliveryTime)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    data.freightSummary,
                    color = if (data.freightSummary.contains("pending", ignoreCase = true)) LiveLoadsSecondary.copy(alpha = 0.82f) else LiveLoadsSecondary,
                    fontSize = 13.sp,
                    lineHeight = 17.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = onQuote,
                    colors = ButtonDefaults.buttonColors(containerColor = LiveLoadsYellow, contentColor = Color(0xFF05070C)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.height(48.dp),
                ) {
                    Text("Quote", fontWeight = FontWeight.Black, fontSize = 16.sp)
                }
            }

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                when (preferenceState) {
                    "deleted" -> {
                        OutlinedButton(
                            onClick = { onRestore?.invoke() },
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.heightIn(min = 48.dp),
                        ) {
                            Text("Restore", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Text(
                            "Hidden",
                            color = LiveLoadsDanger,
                            fontSize = 12.sp,
                            modifier = Modifier.align(Alignment.CenterVertically),
                        )
                    }
                    "saved" -> {
                        OutlinedButton(
                            onClick = { onRestore?.invoke() },
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.heightIn(min = 48.dp),
                        ) {
                            Text("Unpin", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = { onHide?.invoke() },
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.heightIn(min = 48.dp),
                        ) {
                            Text("Hide", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Text(
                            "Pinned",
                            color = LiveLoadsSuccess,
                            fontSize = 12.sp,
                            maxLines = 1,
                            modifier = Modifier.align(Alignment.CenterVertically),
                        )
                    }
                    else -> {
                        OutlinedButton(
                            onClick = { onSave?.invoke() },
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.heightIn(min = 48.dp),
                        ) {
                            Text("Pin", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = { onHide?.invoke() },
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.heightIn(min = 48.dp),
                        ) {
                            Text("Hide", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveLoadRouteSection(
    pickupLocation: String,
    pickupTime: String,
    deliveryLocation: String,
    deliveryTime: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF101A31), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            StopMarker(color = LiveLoadsSuccess)
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .height(22.dp)
                    .background(LiveLoadsSecondary.copy(alpha = 0.45f)),
            )
            StopMarker(color = LiveLoadsDanger)
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f)) {
            LiveLoadRouteLine(
                location = pickupLocation,
                dateTime = pickupTime,
                isPickup = true,
            )
            LiveLoadRouteLine(
                location = deliveryLocation,
                dateTime = deliveryTime,
                isPickup = false,
            )
        }
    }
}

@Composable
private fun StopMarker(color: Color) {
    Box(
        modifier = Modifier
            .width(14.dp)
            .height(14.dp)
            .semantics { contentDescription = if (color == LiveLoadsSuccess) "Pickup marker" else "Delivery marker" }
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.18f))
            .padding(3.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .width(8.dp)
                .height(8.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(color),
        )
    }
}

@Composable
private fun LiveLoadRouteLine(
    location: String,
    dateTime: String,
    isPickup: Boolean,
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            location,
            color = LiveLoadsPrimary,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            dateTime,
            color = if (dateTime.contains("TBC", ignoreCase = true)) LiveLoadsSecondary.copy(alpha = 0.82f) else LiveLoadsSecondary,
            fontSize = 13.sp,
            fontWeight = if (isPickup) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}

private fun String?.liveLoadsDateTime(): String {
    val date = runCatching { this?.takeIf { it.isNotBlank() }?.let { OffsetDateTime.parse(it) } }.getOrNull() ?: return "Time TBC"
    val local = date.atZoneSameInstant(ZoneId.of("Europe/London"))
    return local.format(DateTimeFormatter.ofPattern("dd MMM • HH:mm", Locale.UK))
}

private fun String.toJsonObjectOrNull(): JsonObject? {
    if (isBlank()) return null
    val parsed = runCatching { JsonParser.parseString(this) }.getOrNull() ?: return null
    return parsed.takeIf { it.isJsonObject }?.asJsonObject
}

private fun JsonObject?.string(key: String): String? {
    val value = this?.get(key) ?: return null
    return value.asStringOrNull()?.takeIf { it.isNotBlank() }
}

private fun JsonElement?.asStringOrNull(): String? = when {
    this == null || isJsonNull -> null
    isJsonPrimitive -> asJsonPrimitive.asString
    else -> null
}

private fun String.formatWeightLabel(): String {
    val value = trim()
    if (value.isBlank()) return value
    return if (value.any { it.isLetter() }) value else "$value kg"
}

@Preview(showBackground = true, backgroundColor = 0xFF070B14)
@Composable
private fun LiveLoadCardPreview() {
    LiveLoadCard(
        job = DriverJob(
            id = "xdl-c059b7a3",
            status = "posted",
            currentStatus = "posted",
            pickupLocation = "APPROX. AREA • BB1",
            deliveryLocation = "APPROX. AREA • DA8",
            pickupDatetime = "2026-07-13T15:30:00Z",
            deliveryDatetime = "2026-07-14T06:30:00Z",
            clientName = "Loadify Market",
            clientPhone = "",
            vehicleType = "LWB Van",
            cargoType = "Pallets",
            budgetAmount = null,
            loadDetails = """{"pallets":"1"}""",
        ),
        selected = false,
        onOpen = {},
        onQuote = {},
        onSave = {},
        onHide = {},
        onRestore = {},
    )
}
