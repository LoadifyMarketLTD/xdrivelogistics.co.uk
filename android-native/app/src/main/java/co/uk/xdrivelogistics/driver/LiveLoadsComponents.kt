package co.uk.xdrivelogistics.driver

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.uk.xdrivelogistics.driver.data.DriverJob
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val LiveLoadsCardBackground = Color(0xFF0D1424)
private val LiveLoadsCardBorder = Color(0xFF24324D)
private val LiveLoadsPrimary = Color(0xFFF8FAFC)
private val LiveLoadsSecondary = Color(0xFFA9B7D0)
private val LiveLoadsYellow = Color(0xFFFFD200)
private val LiveLoadsSuccess = Color(0xFF25D987)
private val LiveLoadsDanger = Color(0xFFFF5C7A)

internal fun routeToLiveLoadDetails(
    jobId: String,
    onJobSelected: (String) -> Unit,
    onTabChange: (DriverTab) -> Unit,
) {
    onJobSelected(jobId)
    onTabChange(DriverTab.ACTION)
}

internal data class LiveLoadCardData(
    val companyAndReference: String,
    val vehicleType: String,
    val pickupLine: String,
    val pickupTime: String,
    val deliveryLine: String,
    val deliveryTime: String,
    val freightSummary: String,
)

internal fun DriverJob.toLiveLoadCardData(): LiveLoadCardData {
    val company = clientName.takeIf { it.isNotBlank() } ?: "XDrive Marketplace"
    val ref = "REF ${id.take(8).uppercase()}"
    val summary = listOfNotNull(
        cargoType.takeIf { it.isNotBlank() },
        loadDetails.readLoadField("pallets")?.let { "$it pallets" },
        loadDetails.readLoadField("weight")?.let { "$it kg" },
    ).ifEmpty {
        listOf(loadDetails.takeIf { it.isNotBlank() }?.take(90) ?: "Freight details pending")
    }.joinToString(" • ")
    return LiveLoadCardData(
        companyAndReference = "$company • $ref",
        vehicleType = vehicleType.takeIf { it.isNotBlank() } ?: loadDetails.readLoadField("vehicle") ?: "Vehicle TBC",
        pickupLine = pickupLocation.ifBlank { "Pickup location TBC" },
        pickupTime = pickupDatetime.liveLoadsDateTime(),
        deliveryLine = deliveryLocation.ifBlank { "Delivery location TBC" },
        deliveryTime = deliveryDatetime.liveLoadsDateTime(),
        freightSummary = summary,
    )
}

@androidx.compose.runtime.Composable
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
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(data.companyAndReference, color = LiveLoadsPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("Vehicle: ${data.vehicleType}", color = LiveLoadsSecondary, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            LiveLoadStopLine("Pickup", data.pickupLine, data.pickupTime)
            LiveLoadStopLine("Delivery", data.deliveryLine, data.deliveryTime)
            Text("Freight: ${data.freightSummary}", color = LiveLoadsPrimary, fontSize = 13.sp, lineHeight = 18.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            Button(
                onClick = onQuote,
                colors = ButtonDefaults.buttonColors(containerColor = LiveLoadsYellow, contentColor = Color(0xFF05070C)),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text("Quote", fontWeight = FontWeight.Black, fontSize = 16.sp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                when (preferenceState) {
                    "deleted" -> {
                        OutlinedButton(onClick = { onRestore?.invoke() }, modifier = Modifier.weight(1f)) {
                            Text("Restore", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold)
                        }
                        Text("Hidden", color = LiveLoadsDanger, fontSize = 12.sp)
                    }
                    "saved" -> {
                        OutlinedButton(onClick = { onHide?.invoke() }, modifier = Modifier.weight(1f)) {
                            Text("Hide", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold)
                        }
                        Text("Pinned", color = LiveLoadsSuccess, fontSize = 12.sp)
                    }
                    else -> {
                        OutlinedButton(onClick = { onSave?.invoke() }, modifier = Modifier.weight(1f)) {
                            Text("Pin", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold)
                        }
                        OutlinedButton(onClick = { onHide?.invoke() }, modifier = Modifier.weight(1f)) {
                            Text("Hide", color = LiveLoadsPrimary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun LiveLoadStopLine(label: String, location: String, dateTime: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF131D33), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(label, color = LiveLoadsYellow, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(Modifier.height(2.dp))
        Text(location, color = LiveLoadsPrimary, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(1.dp))
        Text(dateTime, color = LiveLoadsSecondary, fontSize = 12.sp)
    }
}

private fun String.readLoadField(key: String): String? {
    val quoted = Regex("\"$key\"\\s*:\\s*\"([^\"]+)\"", RegexOption.IGNORE_CASE).find(this)
    if (quoted != null) return quoted.groupValues.getOrNull(1)?.takeIf { it.isNotBlank() }
    val raw = Regex("\"$key\"\\s*:\\s*([^,}\\]]+)", RegexOption.IGNORE_CASE).find(this)
    return raw?.groupValues?.getOrNull(1)?.trim()?.trim('"')?.takeIf { it.isNotBlank() && it != "null" }
}

private fun String?.liveLoadsDateTime(): String {
    val date = runCatching { this?.takeIf { it.isNotBlank() }?.let { OffsetDateTime.parse(it) } }.getOrNull() ?: return "Time TBC"
    val local = date.atZoneSameInstant(ZoneId.of("Europe/London"))
    return local.format(DateTimeFormatter.ofPattern("dd MMM • HH:mm", Locale.UK))
}
