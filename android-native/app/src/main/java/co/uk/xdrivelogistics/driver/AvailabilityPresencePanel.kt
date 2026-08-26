package co.uk.xdrivelogistics.driver

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import co.uk.xdrivelogistics.driver.data.DriverSession
import kotlinx.coroutines.launch

/**
 * Explicit pre-award availability control.
 *
 * This panel is intentionally separate from active-job TrackingService. It
 * takes one location fix only when the driver presses Start availability,
 * then the server-side presence expires automatically after 1/4/8 hours.
 */
@Composable
fun AvailabilityPresencePanel(session: DriverSession?) {
    val context = LocalContext.current
    val controller = remember(context) {
        AvailabilityPresenceController(context, BuildConfig.XDRIVE_BASE_URL)
    }
    val scope = rememberCoroutineScope()

    var state by remember { mutableStateOf(AvailabilityPresenceUiState()) }
    var visibility by remember { mutableStateOf("private") }
    var hours by remember { mutableStateOf(4) }
    var pendingStart by remember { mutableStateOf(false) }

    fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun startAvailability() {
        val currentSession = session ?: return
        if (state.isSaving) return
        state = state.copy(isSaving = true, message = "", error = "")
        scope.launch {
            controller.start(
                session = currentSession,
                visibility = visibility,
                hours = hours,
                hasLocationPermission = hasLocationPermission(),
            ).onSuccess { presence ->
                visibility = presence.visibility.ifBlank { visibility }
                state = AvailabilityPresenceUiState.from(presence).copy(message = "Availability sharing is active.")
            }.onFailure { error ->
                state = state.copy(isSaving = false, error = error.message ?: "Availability could not be started.")
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        val allowed = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
            hasLocationPermission()
        if (pendingStart && allowed) startAvailability()
        else if (pendingStart && !allowed) state = state.copy(error = "Location permission is required to share availability.")
        pendingStart = false
    }

    LaunchedEffect(session?.accessToken) {
        val currentSession = session ?: run {
            state = AvailabilityPresenceUiState()
            visibility = "private"
            return@LaunchedEffect
        }
        controller.load(currentSession)
            .onSuccess { presence ->
                visibility = presence.visibility.ifBlank { "private" }
                state = AvailabilityPresenceUiState.from(presence)
            }
            .onFailure { error -> state = state.copy(error = error.message ?: "Availability status could not be loaded.") }
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = XDriveTheme.Surface),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, XDriveTheme.Border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text("Available for work", color = XDriveTheme.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text(
                        "Optional pre-award location sharing for Fleet and load matching. This does not start job tracking.",
                        color = XDriveTheme.TextSecondary,
                        fontSize = 13.sp,
                    )
                }
                AvailabilityBadge(if (state.active) "ON" else "OFF", if (state.active) XDriveTheme.Success else XDriveTheme.TextSecondary)
            }

            Spacer(Modifier.height(12.dp))
            Text("Who can see availability", color = XDriveTheme.TextSecondary, fontSize = 12.sp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                AvailabilityChoice("Private", visibility == "private", Modifier.weight(1f)) { visibility = "private" }
                AvailabilityChoice("My Fleet", visibility == "fleet", Modifier.weight(1f)) { visibility = "fleet" }
                AvailabilityChoice("Exchange", visibility == "exchange", Modifier.weight(1f)) { visibility = "exchange" }
            }

            Spacer(Modifier.height(12.dp))
            Text("Auto-off", color = XDriveTheme.TextSecondary, fontSize = 12.sp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                listOf(1, 4, 8).forEach { option ->
                    AvailabilityChoice("${option}h", hours == option, Modifier.weight(1f)) { hours = option }
                }
            }

            if (state.availableUntil != null) {
                Spacer(Modifier.height(10.dp))
                Text("Active until ${state.availableUntil}", color = XDriveTheme.TextSecondary, fontSize = 12.sp)
            }
            if (state.error.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(state.error, color = XDriveTheme.Danger, fontSize = 12.sp)
            } else if (state.message.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(state.message, color = XDriveTheme.Success, fontSize = 12.sp)
            }

            Spacer(Modifier.height(12.dp))
            if (state.active) {
                Button(
                    onClick = {
                        val currentSession = session ?: return@Button
                        if (state.isSaving) return@Button
                        state = state.copy(isSaving = true, message = "", error = "")
                        scope.launch {
                            controller.stop(currentSession)
                                .onSuccess { state = AvailabilityPresenceUiState(message = "Availability sharing stopped.") }
                                .onFailure { error -> state = state.copy(isSaving = false, error = error.message ?: "Availability could not be stopped.") }
                        }
                    },
                    enabled = !state.isSaving,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = XDriveTheme.Danger, contentColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    if (state.isSaving) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                    else Text("Stop availability", fontWeight = FontWeight.Bold)
                }
            } else {
                Button(
                    onClick = {
                        if (session == null || state.isSaving) return@Button
                        if (hasLocationPermission()) startAvailability()
                        else {
                            pendingStart = true
                            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                        }
                    },
                    enabled = session != null && !state.isSaving,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = XDriveTheme.Success, contentColor = XDriveTheme.Background),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    if (state.isSaving) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                    else Text("Start availability", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun AvailabilityChoice(label: String, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, if (active) XDriveTheme.Yellow else XDriveTheme.Border),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (active) XDriveTheme.Yellow.copy(alpha = 0.16f) else Color.Transparent,
            contentColor = if (active) XDriveTheme.Yellow else XDriveTheme.TextSecondary,
        ),
    ) { Text(label, fontSize = 12.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Normal) }
}

@Composable
private fun AvailabilityBadge(label: String, color: Color) {
    Surface(
        color = color.copy(alpha = 0.16f),
        contentColor = color,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, color.copy(alpha = 0.45f)),
    ) {
        Text(label, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}
