package co.uk.xdrivelogistics.driver.nativepreview

import androidx.compose.foundation.BorderStroke
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

private val ModuleCard = Color.White
private val ModuleNavy = Color(0xFF0B2F6B)
private val ModuleOrange = Color(0xFFF5A300)
private val ModuleLine = Color(0xFFDCE3EA)
private val ModuleText = Color(0xFF111827)
private val ModuleMuted = Color(0xFF667085)
private val ModuleBlue = Color(0xFF1D57D8)

@Composable
fun AlertsNativeScreen(state: DriverModulesState, onRefresh: () -> Unit) {
    var selected by remember { mutableStateOf("inbox") }
    Column(Modifier.fillMaxSize()) {
        StatusTabs(
            listOf("Inbox" to "inbox", "Saved" to "saved", "Deleted" to "deleted"),
            selected
        ) { selected = it }
        val alerts = if (selected == "inbox") state.alerts else emptyList()
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
        ) { alert -> AlertCard(alert) }
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
private fun AlertCard(alert: NativeAlert) {
    BaseModuleCard {
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
