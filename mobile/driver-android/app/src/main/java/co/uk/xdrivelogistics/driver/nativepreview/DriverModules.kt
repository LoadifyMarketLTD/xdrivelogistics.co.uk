package co.uk.xdrivelogistics.driver.nativepreview

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.uk.xdrivelogistics.driver.nativepreview.model.*
import co.uk.xdrivelogistics.driver.nativepreview.ui.DriverModulesState
import java.util.Locale
import org.json.JSONObject

private val ModuleCard = Color.White
private val ModuleNavy = Color(0xFF0B2F6B)
private val ModuleOrange = Color(0xFFF5A300)
private val ModuleLine = Color(0xFFDCE3EA)
private val ModuleText = Color(0xFF111827)
private val ModuleMuted = Color(0xFF667085)
private val ModuleBlue = Color(0xFF1D57D8)

@Composable
fun AlertsNativeScreen(state: DriverModulesState, onRefresh: () -> Unit, onAction: (String, String) -> Unit) {
    var selected by remember { mutableStateOf("inbox") }
    var selectedAlert by remember { mutableStateOf<NativeAlert?>(null) }

    selectedAlert?.let { alert ->
        AlertDetailNativeScreen(
            alert = alert,
            state = state,
            onBack = { selectedAlert = null },
            onAction = onAction
        )
        return
    }

    Column(Modifier.fillMaxSize()) {
        StatusTabs(
            listOf("Inbox" to "inbox", "Saved" to "saved", "Deleted" to "deleted"),
            selected
        ) { selected = it }
        val alerts = when (selected) {
            "saved" -> state.alerts.filter { it.saved && !it.deleted }
            "deleted" -> state.alerts.filter { it.deleted }
            else -> state.alerts.filter { !it.deleted }
        }
        ModuleList(
            when (selected) {
                "saved" -> "No saved alerts"
                "deleted" -> "No deleted alerts"
                else -> "No operational alerts"
            },
            state.loading,
            state.error,
            onRefresh,
            alerts
        ) { alert -> AlertCard(alert) {
            if (alert.actionable && alert.unread) onAction(alert.id, "mark_notification_read")
            selectedAlert = alert
        } }
    }
}

@Composable
fun QuotesNativeScreen(state: DriverModulesState, onRefresh: () -> Unit) {
    var selected by remember { mutableStateOf("submitted") }
    Column(Modifier.fillMaxSize()) {
        StatusTabs(
            listOf(
                "Submitted" to "submitted",
                "Accepted" to "accepted",
                "Withdrawn" to "withdrawn",
                "Unsuccessful" to "unsuccessful"
            ),
            selected
        ) { selected = it }

        val quotes = state.quotes.filter {
            val status = it.status.lowercase(Locale.UK)
            if (selected == "submitted") status == "submitted" || status == "pending"
            else status == selected
        }

        ModuleList(
            "No ${selected.replaceFirstChar { it.uppercase() }} quotes",
            state.loading,
            state.error,
            onRefresh,
            quotes
        ) { quote -> QuoteCard(quote) }
    }
}

@Composable
fun BookingsNativeScreen(state: DriverModulesState, onRefresh: () -> Unit) {
    var selected by remember { mutableStateOf("active") }
    Column(Modifier.fillMaxSize()) {
        StatusTabs(
            listOf(
                "Active" to "active",
                "Upcoming" to "upcoming",
                "Completed" to "completed"
            ),
            selected
        ) { selected = it }

        val bookings = when (selected) {
            "upcoming" -> state.upcoming
            "completed" -> state.completed
            else -> state.bookings
        }

        ModuleList(
            when (selected) {
                "upcoming" -> "No upcoming bookings"
                "completed" -> "No completed bookings"
                else -> "No active bookings"
            },
            state.loading,
            state.error,
            onRefresh,
            bookings
        ) { booking -> BookingCard(booking) }
    }
}

@Composable
private fun StatusTabs(
    labels: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit
) {
    Surface(color = ModuleNavy) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            labels.forEach { (label, key) ->
                Button(
                    onClick = { onSelect(key) },
                    modifier = Modifier.weight(1f).height(38.dp),
                    shape = RoundedCornerShape(19.dp),
                    contentPadding = PaddingValues(horizontal = 4.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (selected == key) ModuleOrange else Color(0xFF284D86),
                        contentColor = if (selected == key) Color(0xFF172033) else Color.White
                    )
                ) {
                    Text(
                        label,
                        maxLines = 1,
                        fontSize = if (labels.size > 3) 10.sp else 12.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }
        }
    }
}

@Composable
private fun AlertCard(alert: NativeAlert, onOpen: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, ModuleLine),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = ModuleCard)
    ) {
        Column(Modifier.padding(13.dp)) {
            Row(Modifier.fillMaxWidth()) {
                Text(
                    alert.title,
                    Modifier.weight(1f),
                    color = ModuleText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                NativeBadge(if (alert.unread) "NEW" else "READ", alert.unread)
            }
            if (alert.body.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    alert.body,
                    color = ModuleMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = 18.sp
                )
            }
            Spacer(Modifier.height(8.dp))
            Text("View details  ›", color = ModuleBlue, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
private fun AlertDetailNativeScreen(
    alert: NativeAlert,
    state: DriverModulesState,
    onBack: () -> Unit,
    onAction: (String, String) -> Unit
) {
    val payload = remember(alert.payloadJson) { runCatching { JSONObject(alert.payloadJson) }.getOrElse { JSONObject() } }
    val jobId = sequenceOf(
        alert.entityId,
        payload.optString("jobId"),
        payload.optString("job_id"),
        payload.optString("loadId"),
        payload.optString("load_id")
    ).firstOrNull { !it.isNullOrBlank() }

    val allBookings = remember(state.bookings, state.upcoming, state.completed) {
        (state.bookings + state.upcoming + state.completed).distinctBy { it.id }
    }
    val booking = allBookings.firstOrNull { it.id == jobId }
    val quote = state.quotes.firstOrNull { it.jobId == jobId }
    val companyName = booking?.companyName
        ?: payload.optString("companyName").ifBlank { payload.optString("company_name") }
    val companyId = booking?.memberId
        ?: payload.optString("companyXdId").ifBlank { payload.optString("company_xd_id") }
    val route = booking?.let { "${it.pickup.uppercase(Locale.UK)}  →  ${it.delivery.uppercase(Locale.UK)}" }
        ?: payload.optString("route")
    val notes = sequenceOf(
        payload.optString("notes"),
        payload.optString("message"),
        payload.optString("body")
    ).firstOrNull { it.isNotBlank() }.orEmpty()
    val amount = quote?.amount
        ?: payload.optDouble("amount", Double.NaN).takeIf { it.isFinite() }
        ?: payload.optDouble("acceptedAmount", Double.NaN).takeIf { it.isFinite() }

    Column(Modifier.fillMaxSize()) {
        Surface(color = ModuleNavy) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                TextButton(onClick = onBack) {
                    Text("‹ Back", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
                Column(Modifier.weight(1f)) {
                    Text("Alert Detail", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                    Text(
                        alert.type.replace('_', ' ').uppercase(Locale.UK),
                        color = Color(0xFFDDE7F5),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                NativeBadge(if (alert.unread) "NEW" else "READ", alert.unread)
            }
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(12.dp)
        ) {
            item {
                BaseModuleCard {
                    Text(alert.title, color = ModuleText, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                    alert.createdAt?.let {
                        Spacer(Modifier.height(5.dp))
                        Text(it.replace('T', ' ').take(16), color = ModuleMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    if (alert.body.isNotBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(alert.body, color = ModuleMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
                    }
                }
            }
            if (companyName.isNotBlank() || companyId?.isNotBlank() == true) {
                item {
                    BaseModuleCard {
                        Text("Company", color = ModuleMuted, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            listOfNotNull(companyName.takeIf { it.isNotBlank() }, companyId?.takeIf { it.isNotBlank() }?.let { "($it)" }).joinToString(" "),
                            color = ModuleText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
            if (!route.isNullOrBlank()) {
                item {
                    BaseModuleCard {
                        Text("Job", color = ModuleMuted, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.height(5.dp))
                        Text(route, color = ModuleText, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                        booking?.let {
                            Spacer(Modifier.height(8.dp))
                            Text(it.reference, color = ModuleMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            NativeBadge(it.status.replace('_', ' ').uppercase(Locale.UK), true)
                        }
                    }
                }
            }
            if (quote != null || amount != null) {
                item {
                    BaseModuleCard {
                        Text("Quote", color = ModuleMuted, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.height(5.dp))
                        amount?.let {
                            Text(money(it, quote?.currency ?: "GBP"), color = ModuleText, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        quote?.let {
                            Spacer(Modifier.height(7.dp))
                            Row(Modifier.fillMaxWidth()) {
                                NativeBadge(it.status.uppercase(Locale.UK), it.status.equals("accepted", true))
                                Spacer(Modifier.weight(1f))
                                it.createdAt?.let { created ->
                                    Text(created.replace('T', ' ').take(16), color = ModuleMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
            if (notes.isNotBlank()) {
                item {
                    BaseModuleCard {
                        Text("Notes & instructions", color = ModuleMuted, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.height(5.dp))
                        Text(notes, color = ModuleText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
                    }
                }
            }
            item {
                BaseModuleCard {
                    Text("Activity", color = ModuleMuted, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(5.dp))
                    Text(
                        "Event: ${alert.type.replace('_', ' ')}" +
                            (alert.entityType?.let { "\nEntity: $it" } ?: "") +
                            (jobId?.let { "\nReference: $it" } ?: ""),
                        color = ModuleText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 19.sp
                    )
                }
            }
            if (alert.actionable) {
                item {
                    BaseModuleCard {
                        Text("Alert actions", color = ModuleMuted, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.height(8.dp))
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    onAction(alert.id, if (alert.saved) "unsave_notification" else "save_notification")
                                    onBack()
                                },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(if (alert.saved) "Unsave" else "Save", fontWeight = FontWeight.ExtraBold)
                            }
                            OutlinedButton(
                                onClick = {
                                    onAction(alert.id, if (alert.deleted) "restore_notification" else "delete_notification")
                                    onBack()
                                },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(if (alert.deleted) "Restore" else "Delete", fontWeight = FontWeight.ExtraBold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuoteCard(quote: NativeQuote) {
    BaseModuleCard {
        Text(
            "${quote.pickup.uppercase(Locale.UK)}  →  ${quote.delivery.uppercase(Locale.UK)}",
            color = ModuleText,
            fontSize = 15.sp,
            fontWeight = FontWeight.ExtraBold
        )
        Spacer(Modifier.height(7.dp))
        Row(Modifier.fillMaxWidth()) {
            NativeBadge(quote.status.uppercase(Locale.UK), quote.status.equals("accepted", true))
            Spacer(Modifier.weight(1f))
            quote.amount?.let {
                Text(money(it, quote.currency), color = ModuleText, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
        quote.collectWithinMinutes?.let {
            Spacer(Modifier.height(6.dp))
            Text("Collect within $it min", color = ModuleMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun BookingCard(booking: NativeBooking) {
    BaseModuleCard {
        Text(
            listOfNotNull(booking.companyName, booking.memberId?.let { "($it)" })
                .joinToString(" ")
                .ifBlank { booking.reference },
            color = ModuleText,
            fontSize = 15.sp,
            fontWeight = FontWeight.ExtraBold
        )
        Spacer(Modifier.height(3.dp))
        Text(booking.reference, color = ModuleMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "${booking.pickup.uppercase(Locale.UK)}  →  ${booking.delivery.uppercase(Locale.UK)}",
            color = ModuleText,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold
        )
        Spacer(Modifier.height(7.dp))
        Row(Modifier.fillMaxWidth()) {
            NativeBadge(booking.status.replace('_', ' ').uppercase(Locale.UK), true)
            Spacer(Modifier.weight(1f))
            booking.price?.let {
                Text(money(it, booking.currency), color = ModuleText, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun BaseModuleCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, ModuleLine),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = ModuleCard)
    ) {
        Column(Modifier.padding(13.dp), content = content)
    }
}

@Composable
private fun NativeBadge(label: String, positive: Boolean) {
    val background = if (positive) Color(0xFFEAF7EE) else Color(0xFFFFF1D8)
    val foreground = if (positive) Color(0xFF16813B) else Color(0xFFB86A00)
    Surface(color = background, shape = RoundedCornerShape(7.dp)) {
        Text(
            label,
            Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
            color = foreground,
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold
        )
    }
}

@Composable
private fun <T> ModuleList(
    emptyTitle: String,
    loading: Boolean,
    error: String?,
    onRefresh: () -> Unit,
    rows: List<T>,
    row: @Composable (T) -> Unit
) {
    when {
        loading && rows.isEmpty() -> {
            Box(Modifier.fillMaxSize().padding(40.dp)) {
                CircularProgressIndicator(color = ModuleBlue)
            }
        }
        rows.isEmpty() -> {
            Card(
                Modifier.fillMaxWidth().padding(14.dp),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, ModuleLine),
                colors = CardDefaults.cardColors(containerColor = ModuleCard)
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(emptyTitle, color = ModuleText, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(6.dp))
                    Text(error ?: "Nothing here yet.", color = ModuleMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onRefresh) {
                        Text("Refresh", color = ModuleBlue, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        else -> {
            LazyColumn(
                Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(12.dp)
            ) {
                items(rows) { item -> row(item) }
            }
        }
    }
}

private fun money(value: Double, currency: String): String =
    (if (currency.uppercase(Locale.UK) == "GBP") "£" else "$currency ") +
        String.format(Locale.UK, "%.2f", value)
