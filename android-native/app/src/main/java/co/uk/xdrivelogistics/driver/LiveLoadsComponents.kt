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
internal data class LiveLoadsEmptyState(val title: String, val message: String)

internal fun liveLoadsEmptyState(box: LiveLoadsBox, activeDeliveryPostcode: String?): LiveLoadsEmptyState = when (box) {
    LiveLoadsBox.PINNED -> LiveLoadsEmptyState("No pinned loads.", "Pin loads from Live to keep them ready for quick quoting.")
    LiveLoadsBox.HIDDEN -> LiveLoadsEmptyState("No hidden loads.", "Loads you hide will appear here so you can restore them later.")
    LiveLoadsBox.LIVE -> LiveLoadsEmptyState(
        "No live loads.",
        if (activeDeliveryPostcode.isNullOrBlank()) "Take a run first and the app will search around its delivery postcode."
        else "No posted pickup loads found within your selected radius of $activeDeliveryPostcode.",
    )
}

internal fun routeToLiveLoadAction(jobId: String, mode: ActionEntryMode, onOpenActionForJob: (String, ActionEntryMode) -> Unit) {
    onOpenActionForJob(jobId, mode)
}
internal fun openLiveLoadFromCard(jobId: String, onOpenActionForJob: (String, ActionEntryMode) -> Unit) = routeToLiveLoadAction(jobId, ActionEntryMode.DETAILS, onOpenActionForJob)
internal fun openLiveLoadQuoteFlow(jobId: String, onOpenActionForJob: (String, ActionEntryMode) -> Unit) = routeToLiveLoadAction(jobId, ActionEntryMode.QUOTE, onOpenActionForJob)

internal fun filterLiveLoadsByBox(jobs: List<DriverJob>, preferences: Map<String, String>, box: LiveLoadsBox): List<DriverJob> = jobs.filter { job ->
    when (box) {
        LiveLoadsBox.PINNED -> preferences[job.id] == "saved"
        LiveLoadsBox.HIDDEN -> preferences[job.id] == "deleted"
        LiveLoadsBox.LIVE -> preferences[job.id] !in setOf("saved", "deleted")
    }
}
internal fun liveLoadsCounts(jobs: List<DriverJob>, preferences: Map<String, String>): Triple<Int, Int, Int> = Triple(
    filterLiveLoadsByBox(jobs, preferences, LiveLoadsBox.LIVE).size,
    filterLiveLoadsByBox(jobs, preferences, LiveLoadsBox.PINNED).size,
    filterLiveLoadsByBox(jobs, preferences, LiveLoadsBox.HIDDEN).size,
)
internal fun applyLiveLoadPreferenceAction(action: LiveLoadPreferenceAction): String? = when (action) {
    LiveLoadPreferenceAction.PIN -> "saved"
    LiveLoadPreferenceAction.HIDE -> "deleted"
    LiveLoadPreferenceAction.RESTORE -> null
}

internal enum class QuoteValidationResult {
    OK,
    NO_JOB_SELECTED,
    JOB_NOT_POSTED,
    INVALID_AMOUNT,
    INVALID_EXTRAS,
    INVALID_COLLECTION_TIME,
    INVALID_VEHICLE,
    INVALID_MESSAGE,
    QUOTE_TOO_HIGH,
}

internal fun QuoteValidationResult.toUserMessage(): String = when (this) {
    QuoteValidationResult.NO_JOB_SELECTED -> "Select a posted job first."
    QuoteValidationResult.JOB_NOT_POSTED -> "Only posted jobs can be quoted."
    QuoteValidationResult.INVALID_AMOUNT -> "Enter a valid quote amount."
    QuoteValidationResult.INVALID_EXTRAS -> "Enter a valid extras amount."
    QuoteValidationResult.INVALID_COLLECTION_TIME -> "Collection time must be between 5 and 240 minutes."
    QuoteValidationResult.INVALID_VEHICLE -> "Select the vehicle currently assigned to your driver profile."
    QuoteValidationResult.INVALID_MESSAGE -> "Quote message is too long."
    QuoteValidationResult.QUOTE_TOO_HIGH -> "Quote total is too high."
    QuoteValidationResult.OK -> ""
}

internal fun parseFinitePositiveAmount(text: String): Double? {
    val d = text.trim().toDoubleOrNull() ?: return null
    return if (d.isFinite() && d > 0.0) d else null
}

internal fun validateQuoteSubmission(quoteJobId: String?, jobs: List<DriverJob>, amountText: String): QuoteValidationResult {
    val job = jobs.firstOrNull { it.id == quoteJobId } ?: return QuoteValidationResult.NO_JOB_SELECTED
    if (job.status.lowercase() != "posted") return QuoteValidationResult.JOB_NOT_POSTED
    if (parseFinitePositiveAmount(amountText) == null) return QuoteValidationResult.INVALID_AMOUNT
    return QuoteValidationResult.OK
}

internal fun resolveQuoteJobId(quoteJobId: String?, jobs: List<DriverJob>): String? = jobs.firstOrNull { it.id == quoteJobId }?.id

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
    val ref = details.string("public_reference") ?: details.string("job_reference") ?: details.string("reference") ?: id.take(8).uppercase().ifBlank { "TBC" }
    val pallets = details.string("pallets")?.takeIf { it.isNotBlank() && !it.equals("0", ignoreCase = true) }?.let { "$it pallets" }
    val weight = details.string("weight")?.formatWeightLabel()
    val specialRequirements = details.string("special_requirements") ?: details.string("requirements")
    val summary = listOfNotNull(
        cargoType.takeIf { it.isNotBlank() }, pallets, weight,
        specialRequirements?.takeIf { it.isNotBlank() }?.let { "Req: $it" },
    ).ifEmpty { listOf("Freight details pending") }.joinToString(" • ")
    return LiveLoadCardData(
        companyName = company,
        reference = ref,
        vehicleType = vehicleType.takeIf { it.isNotBlank() } ?: "Vehicle TBC",
        pickupLine = pickupLocation.ifBlank { pickupPostcode.ifBlank { "Collection area" } },
        pickupTime = pickupDatetime.driverDateTimeLabel(),
        deliveryLine = deliveryLocation.ifBlank { deliveryPostcode.ifBlank { "Delivery area" } },
        deliveryTime = deliveryDatetime.driverDateTimeLabel(),
        freightSummary = summary,
    )
}

internal fun DriverJob.marketplaceBadges(): List<PostedBadgeData> {
    val badges = mutableListOf<PostedBadgeData>()
    if (budgetAmount != null && budgetAmount > 0.0) badges += PostedBadgeData("PRICE", LiveLoadsSuccess, Color.White)
    if (loadDetails.contains("direct delivery", ignoreCase = true)) badges += PostedBadgeData("DIRECT", LiveLoadsYellow, Color.Black)
    return badges
}

internal data class PostedBadgeData(val label: String, val color: Color, val textColor: Color)

@Composable
internal fun LiveLoadCard(
    job: DriverJob,
    selected: Boolean,
    onOpen: () -> Unit,
    onQuote: () -> Unit,
    onSave: () -> Unit,
    onHide: () -> Unit,
    onRestore: () -> Unit,
    preferenceState: String?,
) {
    val data = job.toLiveLoadCardData()
    Card(
        colors = CardDefaults.cardColors(containerColor = LiveLoadsCardBackground),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, if (selected) LiveLoadsYellow else LiveLoadsCardBorder),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Live load ${data.reference}" },
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(data.companyName, color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Load ${data.reference}", color = LiveLoadsSecondary, fontSize = 12.sp)
                }
                Text(data.vehicleType, color = LiveLoadsYellow, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
            Text("${data.pickupLine} → ${data.deliveryLine}", color = LiveLoadsPrimary, modifier = Modifier.padding(top = 10.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("${data.pickupTime} · ${data.freightSummary}", color = LiveLoadsSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) {
                Button(onClick = onQuote, colors = ButtonDefaults.buttonColors(containerColor = LiveLoadsYellow, contentColor = Color.Black)) { Text("Quote", fontWeight = FontWeight.Bold) }
                OutlinedButton(onClick = onOpen) { Text("Details") }
                when (preferenceState) {
                    "saved" -> OutlinedButton(onClick = onRestore) { Text("Unpin") }
                    "deleted" -> OutlinedButton(onClick = onRestore) { Text("Restore") }
                    else -> {
                        OutlinedButton(onClick = onSave) { Text("Pin") }
                        OutlinedButton(onClick = onHide) { Text("Hide") }
                    }
                }
            }
        }
    }
}

internal fun String?.driverDateTimeLabel(): String {
    if (this.isNullOrBlank()) return "Time TBC"
    return runCatching {
        OffsetDateTime.parse(this).atZoneSameInstant(ZoneId.of("Europe/London")).format(DateTimeFormatter.ofPattern("dd MMM HH:mm", Locale.UK))
    }.getOrDefault(this)
}

private fun String.toJsonObjectOrNull(): JsonObject? = runCatching { JsonParser.parseString(this) }.getOrNull()?.takeIf(JsonElement::isJsonObject)?.asJsonObject
private fun JsonObject?.string(key: String): String? = this?.get(key)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrNull() }
private fun String.formatWeightLabel(): String = if (contains("kg", true)) this else "$this kg"
