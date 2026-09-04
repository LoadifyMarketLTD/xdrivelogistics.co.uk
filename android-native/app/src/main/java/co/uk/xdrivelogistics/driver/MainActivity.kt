package co.uk.xdrivelogistics.driver

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.sp
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverNotification
import com.google.android.gms.location.LocationServices
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

// Colour aliases — single source of truth is XDriveTheme.kt
private val Navy = XDriveTheme.Background
private val Navy2 = XDriveTheme.Canvas
private val Panel = XDriveTheme.Surface
private val Border = XDriveTheme.Border
private val Blue = XDriveTheme.Navy
private val Yellow = XDriveTheme.Yellow
private val TextPrimary = XDriveTheme.TextPrimary
private val TextSecondary = XDriveTheme.TextSecondary
private val Danger = XDriveTheme.Danger
private val Success = XDriveTheme.Success

private data class ComplianceDocOption(
    val label: String,
    val docType: String,
    val isVehicleDocument: Boolean,
)

private val ComplianceDocumentOptions = listOf(
    ComplianceDocOption("Driving Licence", "Driving Licence", isVehicleDocument = false),
    ComplianceDocOption("Insurance Certificate", "Insurance", isVehicleDocument = false),
    ComplianceDocOption("Vehicle Registration", "Vehicle Registration", isVehicleDocument = true),
    ComplianceDocOption("Right to Work", "Right to Work", isVehicleDocument = false),
    ComplianceDocOption("Vehicle MOT", "MOT", isVehicleDocument = true),
)

class MainActivity : ComponentActivity() {
    private val viewModel: DriverViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val fusedClient = LocationServices.getFusedLocationProviderClient(this)

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Yellow,
                    secondary = Blue,
                    background = Navy,
                    surface = Navy2,
                    onPrimary = Color(0xFF05070C),
                    onSecondary = TextPrimary,
                    onBackground = TextPrimary,
                    onSurface = TextPrimary,
                )
            ) {
                val state by viewModel.uiState.collectAsState()
                val snackbarHostState = remember { SnackbarHostState() }
                var pendingPodPhotoUri by remember { mutableStateOf<Uri?>(null) }
                var pendingComplianceDoc by remember { mutableStateOf<ComplianceDocOption?>(null) }
                var startTrackingAfterPermission by remember { mutableStateOf(false) }

                fun uploadPodUri(uri: Uri, fallbackName: String, fallbackMime: String) {
                    val mimeType = contentResolver.getType(uri) ?: fallbackMime
                    val fileName = displayName(uri) ?: (uri.lastPathSegment ?: fallbackName).substringAfterLast('/')
                    contentResolver.openInputStream(uri)?.use { input ->
                        val buffer = ByteArrayOutputStream()
                        val data = ByteArray(8 * 1024)
                        while (true) {
                            val count = input.read(data)
                            if (count <= 0) break
                            buffer.write(data, 0, count)
                        }
                        viewModel.uploadPodForSelectedJob(fileName, mimeType, buffer.toByteArray())
                    }
                }

                fun uploadComplianceUri(option: ComplianceDocOption, uri: Uri) {
                    val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                    val fileName = displayName(uri) ?: (uri.lastPathSegment ?: "document").substringAfterLast('/')
                    contentResolver.openInputStream(uri)?.use { input ->
                        val buffer = ByteArrayOutputStream()
                        val data = ByteArray(8 * 1024)
                        while (true) {
                            val count = input.read(data)
                            if (count <= 0) break
                            buffer.write(data, 0, count)
                        }
                        viewModel.uploadComplianceDocument(
                            option.docType,
                            option.isVehicleDocument,
                            fileName,
                            mimeType,
                            buffer.toByteArray(),
                        )
                    }
                }

                val locationPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestMultiplePermissions()
                ) { granted ->
                    val hasLocation = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                        granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
                        hasForegroundLocationPermission()

                    if (hasLocation && startTrackingAfterPermission) {
                        ContextCompat.startForegroundService(
                            this,
                            Intent(this, TrackingService::class.java),
                        )
                    } else if (hasLocation) {
                        fusedClient.lastLocation.addOnSuccessListener { location ->
                            if (location != null) viewModel.sendLocation(location.latitude, location.longitude)
                        }
                    }
                    startTrackingAfterPermission = false
                }

                val podPickerLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.StartActivityForResult()
                ) { result ->
                    val uri = result.data?.data ?: return@rememberLauncherForActivityResult
                    uploadPodUri(uri, "pod-upload", "application/octet-stream")
                }

                val compliancePickerLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.StartActivityForResult()
                ) { result ->
                    val uri = result.data?.data ?: return@rememberLauncherForActivityResult
                    val option = pendingComplianceDoc ?: return@rememberLauncherForActivityResult
                    pendingComplianceDoc = null
                    uploadComplianceUri(option, uri)
                }

                val podCameraLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.TakePicture()
                ) { saved ->
                    val uri = pendingPodPhotoUri
                    if (saved && uri != null) {
                        uploadPodUri(uri, "pod-photo.jpg", "image/jpeg")
                    }
                    pendingPodPhotoUri = null
                }

                val cameraPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { granted ->
                    if (granted) {
                        val uri = createPodPhotoUri()
                        pendingPodPhotoUri = uri
                        podCameraLauncher.launch(uri)
                    }
                }

                LaunchedEffect(state.error, state.message, state.selectedTab) {
                    if (state.selectedTab != DriverTab.ACTION) {
                        if (state.error.isNotBlank()) snackbarHostState.showSnackbar(state.error.toDriverSafeError())
                        if (state.message.isNotBlank()) snackbarHostState.showSnackbar(state.message)
                    }
                }

                Scaffold(
                    containerColor = Navy,
                    snackbarHost = { SnackbarHost(snackbarHostState) },
                ) { padding ->
                    if (!state.isAuthenticated) {
                        LoginScreen(
                            modifier = Modifier.padding(padding),
                            isLoading = state.isLoading,
                            onLogin = viewModel::login,
                        )
                    } else {
                        DriverAppShell(
                            modifier = Modifier.padding(padding),
                            state = state,
                            onTabChange = viewModel::changeTab,
                            onJobSelected = viewModel::selectJob,
                            onOpenActionForJob = viewModel::openActionForJob,
                            onLogout = viewModel::logout,
                            onRefresh = viewModel::refreshDriverData,
                            onSendNote = viewModel::sendQuickNote,
                            onSubmitQuote = viewModel::submitQuoteForSelectedJob,
                            onUpdatePassword = viewModel::updatePassword,
                            onJobPreference = viewModel::setJobSearchPreference,
                            onMoveStatus = viewModel::moveSelectedJobTo,
                            onMarkAlertRead = viewModel::markAlertRead,
                            onDeleteAlert = viewModel::deleteAlert,
                            onSaveReturnJourney = viewModel::saveReturnJourney,
                            onConfirmDeliveryRecipient = viewModel::confirmDeliveryRecipientForSelectedJob,
                            onStartTracking = {
                                if (hasForegroundLocationPermission()) {
                                    ContextCompat.startForegroundService(
                                        this,
                                        Intent(this, TrackingService::class.java),
                                    )
                                } else {
                                    startTrackingAfterPermission = true
                                    locationPermissionLauncher.launch(trackingRuntimePermissions())
                                }
                            },
                            onStopTracking = {
                                stopService(Intent(this, TrackingService::class.java))
                            },
                            onPublishLocation = {
                                startTrackingAfterPermission = false
                                if (hasForegroundLocationPermission()) {
                                    fusedClient.lastLocation.addOnSuccessListener { location ->
                                        if (location != null) viewModel.sendLocation(location.latitude, location.longitude)
                                    }
                                } else {
                                    locationPermissionLauncher.launch(trackingRuntimePermissions(includeNotifications = false))
                                }
                            },
                            onPickPodFile = {
                                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "*/*"
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                }
                                podPickerLauncher.launch(Intent.createChooser(intent, "Select POD document"))
                            },
                            onPickComplianceDocument = { option ->
                                pendingComplianceDoc = option
                                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "*/*"
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                }
                                compliancePickerLauncher.launch(Intent.createChooser(intent, "Select ${option.label}"))
                            },
                            onCapturePodPhoto = {
                                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                            },
                            onNavigateTo = { destination ->
                                val encoded = Uri.encode(destination)
                                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$encoded")))
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(
    modifier: Modifier = Modifier,
    isLoading: Boolean,
    onLogin: (email: String, password: String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Navy)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item { Spacer(Modifier.height(20.dp)) }
        item { XDriveHeroMark() }
        item {
            Text(
                "Welcome back",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 25.sp,
            )
            Text(
                "Sign in to your driver account",
                color = TextSecondary,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
            )
        }
        item {
            XDriveTextField(
                value = email,
                onValueChange = { email = it },
                label = "Email",
                leading = "ID",
                keyboardType = KeyboardType.Email,
            )
        }
        item {
            XDriveTextField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                leading = "Lock",
                isPassword = !showPassword,
                trailing = if (showPassword) "Hide" else "Show",
                onTrailingClick = { showPassword = !showPassword },
            )
        }
        item {
            Button(
                onClick = { onLogin(email.trim(), password) },
                enabled = email.isNotBlank() && password.isNotBlank() && !isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Navy, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                } else {
                    Text("Log In", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            XDriveCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BadgeText("Safe", Blue)
                    Spacer(Modifier.width(14.dp))
                    Text(
                        "You should only use this app when it is safe and legal to do so.",
                        color = TextPrimary,
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                    )
                }
            }
        }
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("By signing-in you agree to our", color = TextSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                Text("Terms & Conditions   |   EULA   |   Privacy Policy", color = TextPrimary, fontSize = 13.sp)
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun DriverAppShell(
    modifier: Modifier,
    state: DriverUiState,
    onTabChange: (DriverTab) -> Unit,
    onJobSelected: (String) -> Unit,
    onOpenActionForJob: (String, ActionEntryMode) -> Unit,
    onLogout: () -> Unit,
    onRefresh: () -> Unit,
    onSendNote: (String, Boolean) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
    onUpdatePassword: (String) -> Unit,
    onJobPreference: (String, String?) -> Unit,
    onMoveStatus: (String) -> Unit,
    onMarkAlertRead: (String) -> Unit,
    onDeleteAlert: (String) -> Unit,
    onSaveReturnJourney: (String, String, String) -> Unit,
    onConfirmDeliveryRecipient: (String) -> Unit,
    onStartTracking: () -> Unit,
    onStopTracking: () -> Unit,
    onPublishLocation: () -> Unit,
    onPickPodFile: () -> Unit,
    onPickComplianceDocument: (ComplianceDocOption) -> Unit,
    onCapturePodPhoto: () -> Unit,
    onNavigateTo: (String) -> Unit,
) {
    var availability by remember { mutableStateOf("Available") }
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Navy)
            .statusBarsPadding()
            // navigationBarsPadding is handled by BottomNav so its background
            // extends behind the system gesture bar; do not apply it here.
    ) {
        AppHeader(
            title = state.headerTitle(),
            isLoading = state.isLoading,
            onRefresh = onRefresh,
        )

        Box(modifier = Modifier.weight(1f)) {
            when (state.selectedTab) {
                DriverTab.NEARBY -> NearbyJobsScreen(state, onOpenActionForJob, onJobPreference)
                DriverTab.QUOTES -> MyQuotesScreen(state)
                DriverTab.BOOKINGS -> BookingsScreen(state, onJobSelected, onTabChange)
                DriverTab.JOBS -> MyJobsScreen(state, onJobSelected, onTabChange, onMoveStatus, onSubmitQuote)
                DriverTab.SMARTPAY -> SmartPayScreen(state)
                DriverTab.ACTION -> ActionScreen(
                    state,
                    onSendNote,
                    onSubmitQuote,
                    onPickPodFile,
                    onCapturePodPhoto,
                    onConfirmDeliveryRecipient,
                    onMoveStatus,
                    onNavigateTo,
                )
                DriverTab.MESSAGES -> MessagesScreen(state, onSendNote, onMarkAlertRead, onDeleteAlert)
                DriverTab.PROFILE -> ProfileScreen(state, onUpdatePassword, onLogout, onPickComplianceDocument, onSaveReturnJourney, onStartTracking, onStopTracking)
            }
        }

        BottomNav(
            selected = state.selectedTab,
            activeCount = state.jobs.count { it.isActive() },
            unreadCount = unreadUpdatesCount(state.notifications),
            onTabChange = onTabChange,
        )
    }
}

@Composable
private fun AppHeader(title: String, isLoading: Boolean, onRefresh: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("XD", color = Yellow, fontWeight = FontWeight.Black, fontSize = 18.sp)
        Spacer(Modifier.width(12.dp))
        Text(title, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (isLoading) CircularProgressIndicator(color = Yellow, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
        TextButton(onClick = onRefresh) { Text("Refresh", color = TextSecondary, fontSize = 13.sp) }
    }
}

@Composable
private fun DashboardScreen(
    state: DriverUiState,
    availability: String,
    onAvailabilityChange: (String) -> Unit,
    onTabChange: (DriverTab) -> Unit,
    onJobSelected: (String) -> Unit,
    onMoveStatus: (String) -> Unit,
    onPublishLocation: () -> Unit,
    onSubmitQuote: (String, String) -> Unit,
) {
    val jobs = state.jobs
    val nextJob = jobs.sortedBy { it.pickupDatetime.orEmpty() }.firstOrNull { it.isActive() } ?: jobs.firstOrNull()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            HeroDashboardCard(
                email = state.session?.email.orEmpty(),
                vehicle = "Driver workspace",
            )
        }
        item {
            XDriveCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Availability", color = TextSecondary, fontSize = 13.sp)
                        Text(availability, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text("Sync ${LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))}", color = TextSecondary, fontSize = 12.sp)
                    }
                    BadgeText(if (state.isLoading) "Syncing" else "Synced", if (state.isLoading) Yellow else Success)
                }
                Spacer(Modifier.height(12.dp))
                SegmentedTabs(listOf("Available", "Busy", "Off Duty"), availability, onAvailabilityChange)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                StatCard("Posted", jobs.count { it.driverStatusKey() == "posted" }, Modifier.weight(1f))
                StatCard("In Progress", jobs.count { it.isInProgress() }, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                StatCard("Completed", jobs.count { it.driverStatusKey() in listOf("completed", "delivered") }, Modifier.weight(1f))
                StatCard("Open", jobs.count { it.isActive() }, Modifier.weight(1f))
            }
        }
        item {
            XDriveCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Driver access", color = TextSecondary, fontSize = 13.sp)
                        Text("Active session", color = TextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        Text("ID ${state.profile?.driverId?.take(8) ?: "-"}", color = TextSecondary, fontSize = 12.sp)
                    }
                    ButtonSmall("GPS", onPublishLocation)
                }
            }
        }
        item {
            Text("Next Job", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
        item {
            if (nextJob == null) {
                EmptyState("No posted jobs found.", "Try refresh, increase the search radius, or clear vehicle filters.")
            } else {
                JobCard(
                    job = nextJob,
                    selected = state.selectedJobId == nextJob.id,
                    onClick = { onJobSelected(nextJob.id); onTabChange(DriverTab.JOBS) },
                    onMoveStatus = onMoveStatus,
                    onSubmitQuote = onSubmitQuote,
                )
            }
        }
    }
}

@Composable
private fun NearbyJobsScreen(
    state: DriverUiState,
    onOpenActionForJob: (String, ActionEntryMode) -> Unit,
    onJobPreference: (String, String?) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var box by remember { mutableStateOf(LiveLoadsBox.LIVE) }
    var sortBy by remember { mutableStateOf("Collection") }
    var radiusMiles by remember { mutableStateOf(20) }
    var dateScope by remember { mutableStateOf("Any date") }
    var vehicleScope by remember { mutableStateOf("All vehicles") }
    var freightScope by remember { mutableStateOf("All freight") }
    var memberScope by remember { mutableStateOf("All members") }
    val activeDeliveryJob = state.jobs.firstOrNull {
        !it.isPosted() && it.isActive() && it.deliveryPostcode.isNotBlank()
    }

    val postedJobs = state.jobs.filter { it.isPosted() }
    val deliveryZoneJobs = if (activeDeliveryJob != null) {
        postedJobs
            .filter { (it.pickupDistanceFromActiveDeliveryMiles ?: Double.MAX_VALUE) <= radiusMiles.toDouble() }
            .sortedBy { it.pickupDistanceFromActiveDeliveryMiles ?: Double.MAX_VALUE }
    } else {
        postedJobs.sortedWith(
            compareBy<DriverJob> { it.pickupDistanceFromActiveDeliveryMiles ?: Double.MAX_VALUE }
                .thenBy { it.pickupDatetime.orEmpty() }
        )
    }
    val boxedJobs = filterLiveLoadsByBox(deliveryZoneJobs, state.jobSearchPreferences, box)
    val (liveCount, pinnedCount, hiddenCount) = liveLoadsCounts(deliveryZoneJobs, state.jobSearchPreferences)
    val searched = boxedJobs.filter {
        val needle = query.trim().lowercase()
        needle.isBlank() ||
            it.id.lowercase().contains(needle) ||
            it.clientName.lowercase().contains(needle) ||
            it.pickupPostcode.lowercase().contains(needle) ||
            it.deliveryPostcode.lowercase().contains(needle) ||
            it.pickupLocation.lowercase().contains(needle) ||
            it.deliveryLocation.lowercase().contains(needle) ||
            it.loadDetails.lowercase().contains(needle)
    }
    val dated = searched.filter { job ->
        val pickup = job.pickupDatetime?.take(10).orEmpty()
        when (dateScope) {
            "Today" -> pickup == LocalDate.now(ZoneId.of("Europe/London")).toString()
            "Tomorrow" -> pickup == LocalDate.now(ZoneId.of("Europe/London")).plusDays(1).toString()
            "This week" -> {
                val today = LocalDate.now(ZoneId.of("Europe/London"))
                val end = today.plusDays(7)
                val parsed = runCatching { LocalDate.parse(pickup) }.getOrNull()
                parsed != null && !parsed.isBefore(today) && !parsed.isAfter(end)
            }
            else -> true
        }
    }

    val vehicleFiltered = dated.filter { vehicleScope == "All vehicles" || it.vehicleType.equals(vehicleScope, ignoreCase = true) }
    val freightFiltered = vehicleFiltered.filter { freightScope == "All freight" || it.cargoType.equals(freightScope, ignoreCase = true) }
    val memberFiltered = freightFiltered.filter { memberScope == "All members" || it.clientName.isNotBlank() }
    val filtered = when (sortBy) {
        "Nearest" -> memberFiltered.sortedBy { it.pickupDistanceFromActiveDeliveryMiles ?: Double.MAX_VALUE }
        else -> memberFiltered.sortedBy { it.pickupDatetime.orEmpty() }
    }
    val emptyState = liveLoadsEmptyState(box, activeDeliveryJob?.deliveryPostcode)
    val vehicleOptions = listOf("All vehicles") + state.jobs.map { it.vehicleType.trim() }.filter { it.isNotBlank() }.distinct().take(5)
    val freightOptions = listOf("All freight") + state.jobs.map { it.cargoType.trim() }.filter { it.isNotBlank() }.distinct().take(5)
    val nearbyDriverRows = nearbyDriverDisplayRows(state.nearbyDrivers)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            LiveLoadsSegmentedTabs(
                selected = box,
                liveCount = liveCount,
                pinnedCount = pinnedCount,
                hiddenCount = hiddenCount,
                onSelected = { box = it },
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (box == LiveLoadsBox.LIVE) "${filtered.size} available" else "${filtered.size} loads",
                    color = TextPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                )
                Text(if (query.isBlank()) sortBy else "Search: \"$query\"", color = TextSecondary, fontSize = 12.sp, maxLines = 1)
            }
        }
        item {
            XDriveTextField(query, { query = it }, "Search jobs", "Find")
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    CompactFilterPill(
                        label = "Sort: $sortBy",
                        onClick = { sortBy = if (sortBy == "Collection") "Nearest" else "Collection" },
                    )
                }
                if (activeDeliveryJob != null) {
                    item {
                        CompactFilterPill(
                            label = "Radius: ${radiusMiles}mi",
                            onClick = { radiusMiles = when (radiusMiles) { 10 -> 20; 20 -> 30; else -> 10 } },
                        )
                    }
                }
                item {
                    CompactFilterPill(
                        label = dateScope,
                        onClick = {
                            dateScope = when (dateScope) {
                                "Any date" -> "Today"
                                "Today" -> "Tomorrow"
                                "Tomorrow" -> "This week"
                                else -> "Any date"
                            }
                        },
                    )
                }
                item {
                    CompactFilterPill(
                        label = vehicleScope,
                        onClick = { vehicleScope = vehicleOptions.nextAfter(vehicleScope) },
                    )
                }
                item {
                    CompactFilterPill(
                        label = freightScope,
                        onClick = { freightScope = freightOptions.nextAfter(freightScope) },
                    )
                }
                item {
                    CompactFilterPill(
                        label = memberScope,
                        onClick = { memberScope = if (memberScope == "All members") "Named members" else "All members" },
                    )
                }
            }
        }
        if (nearbyDriverRows.isNotEmpty()) {
            item {
                XDriveCard {
                    Text("Nearby Drivers", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text(
                        "Privacy-safe presence only — exact driver coordinates are never shown.",
                        color = TextSecondary,
                        fontSize = 12.sp,
                    )
                    nearbyDriverRows.take(5).forEach { driver ->
                        Spacer(Modifier.height(10.dp))
                        Text(driver.driverName, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            "${driver.vehicleLabel} · ${driver.lastSeenLabel}",
                            color = TextSecondary,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
        if (filtered.isEmpty()) {
            item {
                EmptyState(
                    emptyState.title,
                    emptyState.message,
                )
            }
        }
        items(filtered, key = { it.id }) { job ->
            LiveLoadCard(
                job = job,
                selected = state.selectedJobId == job.id,
                onOpen = { openLiveLoadFromCard(job.id, onOpenActionForJob) },
                onQuote = { openLiveLoadQuoteFlow(job.id, onOpenActionForJob) },
                onSave = { onJobPreference(job.id, applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.PIN)) },
                onHide = { onJobPreference(job.id, applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.HIDE)) },
                onRestore = { onJobPreference(job.id, applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.RESTORE)) },
                preferenceState = state.jobSearchPreferences[job.id],
            )
        }
    }
}

@Composable
private fun CompactFilterPill(label: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, Border),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
        modifier = Modifier.heightIn(min = 48.dp),
    ) {
        Text(label, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private fun List<String>.nextAfter(current: String): String {
    if (isEmpty()) return current
    val currentIndex = indexOf(current).takeIf { it >= 0 } ?: 0
    return this[(currentIndex + 1) % size]
}

@Composable
private fun MyJobsScreen(
    state: DriverUiState,
    onJobSelected: (String) -> Unit,
    onTabChange: (DriverTab) -> Unit,
    onMoveStatus: (String) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
) {
    var filter by remember { mutableStateOf("Allocated") }
    var query by remember { mutableStateOf("") }
    val filtered = state.jobs.filter { !it.isPosted() }.filter {
        when (filter) {
            "Allocated" -> it.driverStatusKey() == "allocated"
            "Active" -> it.isActive() && it.driverStatusKey() != "allocated"
            "In Progress" -> it.isInProgress()
            "Completed" -> it.driverStatusKey() in listOf("completed", "delivered")
            "Cancelled" -> it.driverStatusKey() in listOf("cancelled", "canceled")
            else -> true
        }
    }.filter {
        val needle = query.trim().lowercase()
        needle.isBlank() ||
            it.id.lowercase().contains(needle) ||
            it.clientName.lowercase().contains(needle) ||
            it.pickupLocation.lowercase().contains(needle) ||
            it.deliveryLocation.lowercase().contains(needle) ||
            it.loadDetails.lowercase().contains(needle)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { XDriveTextField(query, { query = it }, "Search my jobs", "Find") }
        item { SegmentedTabs(listOf("Allocated", "Active", "In Progress", "Completed", "Cancelled"), filter) { filter = it } }
        if (filtered.isEmpty()) {
            item { EmptyState("No $filter jobs.", "Refresh or check Bookings from Profile if you recently won work.") }
        }
        items(filtered, key = { it.id }) { job ->
            JobCard(
                job = job,
                selected = state.selectedJobId == job.id,
                onClick = {
                    onJobSelected(job.id)
                    onTabChange(DriverTab.ACTION)
                },
                onMoveStatus = onMoveStatus,
                onSubmitQuote = onSubmitQuote,
            )
        }
    }
}

@Composable
private fun BookingsScreen(
    state: DriverUiState,
    onJobSelected: (String) -> Unit,
    onTabChange: (DriverTab) -> Unit,
) {
    var filter by remember { mutableStateOf("Current") }
    val now = java.time.Instant.now()
    val visible = state.jobs.filter { !it.isPosted() }.filter { job ->
        val jobDate = job.pickupDatetime?.let { runCatching { OffsetDateTime.parse(it).toInstant() }.getOrNull() }
        when (filter) {
            "Past 7 Days" -> jobDate?.isAfter(now.minus(java.time.Duration.ofDays(7))) == true && jobDate.isBefore(now)
            "Past 14 Days" -> jobDate?.isAfter(now.minus(java.time.Duration.ofDays(14))) == true && jobDate.isBefore(now)
            "History" -> job.driverStatusKey() in listOf("completed", "delivered", "cancelled", "canceled")
            else -> job.isActive() && job.driverStatusKey() !in listOf("completed", "delivered", "cancelled", "canceled")
        }
    }.sortedBy { it.pickupDatetime.orEmpty() }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { SegmentedTabs(listOf("Current", "Past 7 Days", "Past 14 Days", "History"), filter) { filter = it } }
        if (visible.isEmpty()) {
            item { EmptyState("No bookings.", "Accepted work and recent completed jobs will appear here.") }
        } else {
            items(visible, key = { it.id }) { job ->
                BookingCard(job) {
                    onJobSelected(job.id)
                    onTabChange(DriverTab.ACTION)
                }
            }
        }
    }
}

@Composable
private fun BookingCard(job: DriverJob, onOpen: () -> Unit) {
    XDriveCard {
        Column(Modifier.clickable(onClick = onOpen)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(job.routeLabel(), color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(job.pickupDatetime.marketplaceTime(), color = TextSecondary, fontSize = 13.sp)
                }
                BadgeText(job.statusLabel(), if (job.driverStatusKey() in listOf("completed", "delivered")) Success else Blue)
            }
            Spacer(Modifier.height(10.dp))
            InfoLine("Vehicle", job.vehicleLabel())
            InfoLine("Distance", job.distanceLabel())
        }
    }
}

@Composable
private fun SmartPayScreen(state: DriverUiState) {
    var filter by remember { mutableStateOf("All") }
    val visible = state.invoices.filter { invoice ->
        when (filter) {
            "Pending" -> invoice.status.contains("pending", ignoreCase = true) || invoice.status.contains("submitted", ignoreCase = true)
            "Awaiting Payment" -> invoice.status.contains("approved", ignoreCase = true) || invoice.status.contains("await", ignoreCase = true)
            "Paid" -> invoice.status.contains("paid", ignoreCase = true)
            "Overdue" -> invoice.status.contains("overdue", ignoreCase = true)
            else -> true
        }
    }
    val total = visible.mapNotNull { it.amount }.sum()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            XDriveCard {
                Text("XDrive Pay", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("${visible.size} invoices | GBP ${"%.2f".format(Locale.UK, total)}", color = TextSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    MiniQuoteMetric("Pending", state.invoices.count { it.status.contains("pending", true) || it.status.contains("submitted", true) }.toString())
                    MiniQuoteMetric("Paid", state.invoices.count { it.status.contains("paid", true) }.toString())
                    MiniQuoteMetric("Overdue", state.invoices.count { it.status.contains("overdue", true) }.toString())
                }
            }
        }
        item { SegmentedTabs(listOf("All", "Pending", "Awaiting Payment", "Paid", "Overdue"), filter) { filter = it } }
        if (visible.isEmpty()) {
            item { EmptyState("No invoices.", "Completed jobs that are ready for payment will appear here.") }
        } else {
            items(visible, key = { it.id }) { invoice ->
                InvoiceCard(invoice)
            }
        }
    }
}

@Composable
private fun InvoiceCard(invoice: co.uk.xdrivelogistics.driver.data.DriverInvoice) {
    XDriveCard {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text(invoice.invoiceNumber, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 17.sp)
                Text(invoice.clientName.ifBlank { "Client TBC" }, color = TextSecondary, fontSize = 13.sp)
            }
            BadgeText(invoice.status.ifBlank { "Draft" }, if (invoice.status.contains("paid", true)) Success else Yellow)
        }
        Spacer(Modifier.height(10.dp))
        InfoLine("Amount", invoice.amount?.let { "${invoice.currency} ${"%.2f".format(Locale.UK, it)}" } ?: "TBC")
        InfoLine("Due", invoice.dueDate ?: "TBC")
    }
}

@Composable
private fun MyQuotesScreen(state: DriverUiState) {
    var filter by remember { mutableStateOf("Submitted") }
    val visible = state.bids.filter { bid ->
        when (filter) {
            "Accepted" -> bid.status.equals("accepted", ignoreCase = true)
            "Rejected" -> bid.status.equals("rejected", ignoreCase = true)
            "Withdrawn" -> bid.status.equals("withdrawn", ignoreCase = true)
            "Expired" -> bid.status.equals("expired", ignoreCase = true)
            else -> bid.status.equals("submitted", ignoreCase = true)
        }
    }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { SegmentedTabs(listOf("Submitted", "Accepted", "Rejected", "Withdrawn", "Expired"), filter) { filter = it } }
        if (visible.isEmpty()) {
            item {
                EmptyState(
                    "No ${filter.lowercase()} quotes.",
                    "Quotes you send will appear here with amount, route and outcome.",
                )
            }
        } else {
            items(visible, key = { it.id }) { bid ->
                QuoteHistoryCard(bid)
            }
        }
    }
}

@Composable
private fun QuoteHistoryCard(bid: DriverBid) {
    XDriveCard {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text(
                    bid.clientName.ifBlank { "Posted job" },
                    color = TextPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 17.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(bid.pickupLocation.locationHeadline(), bid.deliveryLocation.locationHeadline())
                        .filter { it.isNotBlank() }
                        .joinToString(" -> ")
                        .ifBlank { "Route TBC" },
                    color = TextSecondary,
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            BadgeText(bid.status.replaceFirstChar { it.uppercase(Locale.UK) }, bid.quoteStatusColor())
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            MiniQuoteMetric("Amount", bid.amount?.let { "${bid.currency.ifBlank { "GBP" }} ${"%.2f".format(Locale.UK, it)}" } ?: "TBC")
            MiniQuoteMetric("Submitted", bid.createdAt?.marketplaceTime().orEmpty().ifBlank { "TBC" })
        }
        if (bid.message.isNotBlank()) {
            Spacer(Modifier.height(10.dp))
            Text(bid.message, color = TextSecondary, fontSize = 13.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
private fun MiniQuoteMetric(label: String, value: String) {
    Column(
        modifier = Modifier
            .background(Navy2, RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        Text(label, color = TextSecondary, fontSize = 11.sp)
        Text(value, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
    }
}

private fun DriverBid.quoteStatusColor(): Color =
    when (status.lowercase(Locale.UK)) {
        "accepted" -> Success
        "rejected", "withdrawn", "expired" -> Danger
        else -> Yellow
    }

@Composable
private fun ActionScreen(
    state: DriverUiState,
    onSendNote: (String, Boolean) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
    onPickPodFile: () -> Unit,
    onCapturePodPhoto: () -> Unit,
    onConfirmDeliveryRecipient: (String) -> Unit,
    onMoveStatus: (String) -> Unit,
    onNavigateTo: (String) -> Unit,
) {
    val selected = state.jobs.firstOrNull { it.id == state.selectedJobId } ?: state.jobs.firstOrNull()
    var note by remember { mutableStateOf("") }
    var important by remember { mutableStateOf(false) }
    var detailTab by remember { mutableStateOf("Summary") }

    if (selected?.isPosted() == true) {
        PostedJobDetailScreen(
            job = selected,
            statusMessage = state.message,
            errorMessage = state.error,
            openQuoteFirst = state.actionEntryMode == ActionEntryMode.QUOTE,
            onSubmitQuote = onSubmitQuote,
            onSendMessage = { onSendNote("Message requested for ${selected.id.take(8).uppercase()}", true) },
            isSubmitting = state.isSubmittingQuote,
        )
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            XDriveCard {
                Text("Job Details", color = TextSecondary, fontSize = 13.sp)
                Text(selected?.routeLabel() ?: "No job selected", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                if (selected != null) {
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        BadgeText(selected.statusLabel(), if (selected.isActive()) Blue else Success)
                        if (selected.hasPod()) BadgeText("POD", Success)
                    }
                }
            }
        }
        item { SegmentedTabs(listOf("Summary", "Stops", "Status", "POD"), detailTab) { detailTab = it } }
        if (selected == null) {
            item { EmptyState("No job selected.", "Open a posted job from Nearby to view details or send a quote.") }
        } else {
            when (detailTab) {
                "Summary" -> item { JobSummaryPanel(selected, onSubmitQuote, state.isSubmittingQuote) }
                "Stops" -> item { JobStopsPanel(selected, onNavigateTo) }
                "Status" -> item { JobStatusPanel(selected, onMoveStatus, onSubmitQuote, state.isSubmittingQuote) }
                "POD" -> item {
                    PodPanel(
                        selected,
                        onCapturePodPhoto,
                        onPickPodFile,
                        onConfirmDeliveryRecipient,
                    )
                }
            }
        }
        item {
            XDriveCard {
                Text("Dispatcher Message", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                XDriveTextField(note, { note = it }, "Note", "Msg")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = important,
                        onCheckedChange = { important = it },
                        colors = CheckboxDefaults.colors(checkedColor = Yellow, checkmarkColor = Navy),
                    )
                    Text("Mark important", color = TextSecondary)
                    Spacer(Modifier.weight(1f))
                    ButtonSmall("Send") {
                        onSendNote(note, important)
                        note = ""
                        important = false
                    }
                }
            }
        }
    }
}

@Composable
private fun JobSummaryPanel(job: DriverJob, onSubmitQuote: (String, String) -> Unit, isSubmitting: Boolean = false) {
    XDriveCard {
        Text("Summary", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        InfoLine("Job Ref", job.id.take(12).uppercase())
        InfoLine("Customer", job.clientName.ifBlank { "Assigned by dispatch" })
        InfoLine("Vehicle", "Linked to driver profile")
        InfoLine("Goods / Details", job.loadDetails.ifBlank { "No load details supplied." })
        InfoLine("Collection Time", job.pickupDatetime ?: "Not set")
        InfoLine("Delivery Time", job.deliveryDatetime ?: "Not set")
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            BadgeText(if (job.pickupDatetime != null) "Timed" else "Flexible", Blue)
            BadgeText(if (job.hasPod()) "POD Uploaded" else "POD Required", if (job.hasPod()) Success else Yellow)
        }
        if (job.isPosted()) {
            Spacer(Modifier.height(14.dp))
            QuoteBox(onSubmitQuote, isSubmitting)
        }
    }
}

@Composable
private fun JobStopsPanel(job: DriverJob, onNavigateTo: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StopCard(
            number = "1",
            title = "Collection",
            address = job.pickupLocation.ifBlank { "Collection address not supplied" },
            time = job.pickupDatetime ?: "Time not set",
            contact = job.clientName.ifBlank { "Dispatch contact" },
            button = "Navigate Pickup",
            onNavigate = { if (job.pickupLocation.isNotBlank()) onNavigateTo(job.pickupLocation) },
        )
        StopCard(
            number = "2",
            title = "Delivery",
            address = job.deliveryLocation.ifBlank { "Delivery address not supplied" },
            time = job.deliveryDatetime ?: "Time not set",
            contact = "Recipient / site contact",
            button = "Navigate Delivery",
            onNavigate = { if (job.deliveryLocation.isNotBlank()) onNavigateTo(job.deliveryLocation) },
        )
    }
}

@Composable
private fun StopCard(
    number: String,
    title: String,
    address: String,
    time: String,
    contact: String,
    button: String,
    onNavigate: () -> Unit,
) {
    XDriveCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BadgeText(number, Yellow)
            Spacer(Modifier.width(10.dp))
            Text(title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
        InfoLine("Address", address)
        InfoLine("Time Window", time)
        InfoLine("Contact", contact)
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = onNavigate,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
            shape = RoundedCornerShape(14.dp),
        ) { Text(button, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun PostedJobDetailScreen(
    job: DriverJob,
    statusMessage: String,
    errorMessage: String,
    openQuoteFirst: Boolean,
    onSubmitQuote: (String, String) -> Unit,
    onSendMessage: () -> Unit,
    isSubmitting: Boolean = false,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF2F4F8))
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 128.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text(
                "Load ID ${job.id.take(8).uppercase()}",
                color = Color(0xFF303344),
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp, bottom = 2.dp),
            )
        }

        if (errorMessage.isNotBlank() || statusMessage.isNotBlank()) {
            item {
                QuoteStatusBanner(
                    title = if (errorMessage.isNotBlank()) "Action needed" else "Quote status",
                    body = errorMessage.toDriverSafeError().ifBlank { statusMessage },
                    isError = errorMessage.isNotBlank(),
                )
            }
        }

        if (openQuoteFirst) {
            item {
                LightDetailCard(contentPadding = 12.dp) {
                    Text("Quote Entry", color = Color(0xFF303344), fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Spacer(Modifier.height(10.dp))
                    if (errorMessage.isNotBlank() || statusMessage.isNotBlank()) {
                        QuoteStatusBanner(
                            title = if (errorMessage.isNotBlank()) "Action needed" else "Quote status",
                            body = errorMessage.toDriverSafeError().ifBlank { statusMessage },
                            isError = errorMessage.isNotBlank(),
                        )
                        Spacer(Modifier.height(12.dp))
                    }
                    QuoteBoxLight(onSubmitQuote, isSubmitting)
                }
            }
        }

        item {
            LightDetailCard {
                DetailRow(
                    icon = "V",
                    label = "VEHICLE",
                    value = job.vehicleLabel(),
                )
                Spacer(Modifier.height(18.dp))
                DetailRow(
                    icon = "M",
                    label = "DISTANCE",
                    value = job.distanceLabel(),
                )
            }
        }

        item {
            LightDetailCard(contentPadding = 14.dp) {
                DetailRow("C", "CUSTOMER", job.marketplaceTitle())
                Spacer(Modifier.height(12.dp))
                DetailRow("P", "PHONE", job.phoneLabel())
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = onSendMessage,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4C9BE8), contentColor = Color.White),
                    shape = RoundedCornerShape(999.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                ) { Text("Message", fontWeight = FontWeight.Black, fontSize = 15.sp) }
            }
        }

        item {
            LightDetailCard {
                Text(job.marketplaceTitle(), color = Color(0xFF303344), fontWeight = FontWeight.Black, fontSize = 20.sp)
                Spacer(Modifier.height(6.dp))
                Text(job.marketplaceMeta(), color = Color(0xFF6C6F7D), fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(job.marketplaceBadges()) { badge ->
                        PostedBadge(badge.label, badge.color, badge.textColor)
                    }
                }
                Spacer(Modifier.height(14.dp))
                PostedRouteBox(job)
            }
        }

        if (!openQuoteFirst) {
            item {
                LightDetailCard(contentPadding = 12.dp) {
                    if (errorMessage.isNotBlank() || statusMessage.isNotBlank()) {
                        QuoteStatusBanner(
                            title = if (errorMessage.isNotBlank()) "Action needed" else "Quote status",
                            body = errorMessage.toDriverSafeError().ifBlank { statusMessage },
                            isError = errorMessage.isNotBlank(),
                        )
                        Spacer(Modifier.height(12.dp))
                    }
                    QuoteBoxLight(onSubmitQuote, isSubmitting)
                }
            }
        }

        item {
            LightDetailCard {
                Text("Feedback", color = Color(0xFF303344), fontWeight = FontWeight.Black, fontSize = 19.sp)
                Text("Past 90 days", color = Color(0xFF6C6F7D), fontSize = 13.sp)
                Spacer(Modifier.height(12.dp))
                Box(Modifier.fillMaxWidth().height(2.dp).background(Color(0xFF4C9BE8)))
                Spacer(Modifier.height(12.dp))
                FeedbackLine("Payment", "0", "0", "0")
                FeedbackLine("Delivery", "0", "0", "0")
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {},
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4C9BE8), contentColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("All Feedback", fontWeight = FontWeight.Black) }
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun QuoteStatusBanner(title: String, body: String, isError: Boolean) {
    Surface(
        color = if (isError) Color(0xFFFFEEF1) else Color(0xFFEAF8EF),
        contentColor = if (isError) Color(0xFF8C1D2D) else Color(0xFF116B34),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, if (isError) Color(0xFFFFB7C2) else Color(0xFF9DE3B7)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(title, fontWeight = FontWeight.Black, fontSize = 15.sp)
            Spacer(Modifier.height(4.dp))
            Text(body, fontSize = 13.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
private fun LightDetailCard(content: @Composable ColumnScope.() -> Unit) {
    LightDetailCard(contentPadding = 18.dp, content = content)
}

@Composable
private fun LightDetailCard(contentPadding: androidx.compose.ui.unit.Dp, content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color(0xFFE3E7EF)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(contentPadding), content = content)
    }
}

@Composable
private fun DetailRow(icon: String, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(Color(0xFFF0F3F8)),
            contentAlignment = Alignment.Center,
        ) {
            Text(icon, color = Color(0xFF303344), fontWeight = FontWeight.Black, fontSize = 16.sp)
        }
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Color(0xFF7B7D8A), fontWeight = FontWeight.Black, fontSize = 13.sp, letterSpacing = 3.sp)
            Text(value, color = Color(0xFF202231), fontWeight = FontWeight.Medium, fontSize = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun FeedbackLine(label: String, positive: String, neutral: String, negative: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Color(0xFF303344), fontSize = 16.sp, modifier = Modifier.weight(1f))
        Text(positive, color = Color(0xFF303344), fontSize = 16.sp, modifier = Modifier.width(48.dp), textAlign = TextAlign.Center)
        Text(neutral, color = Color(0xFF303344), fontSize = 16.sp, modifier = Modifier.width(48.dp), textAlign = TextAlign.Center)
        Text(negative, color = Color(0xFF303344), fontSize = 16.sp, modifier = Modifier.width(48.dp), textAlign = TextAlign.Center)
    }
}

@Composable
private fun QuoteBoxLight(onSubmitQuote: (String, String) -> Unit, isSubmitting: Boolean = false) {
    var amount by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    val fieldText = Color(0xFF202231)
    val fieldLabel = Color(0xFF7B7D8A)
    val fieldBorder = Color(0xFF8E919B)
    val fieldFocus = Color(0xFF4D9BE8)
    Text("Submit quote", color = Color(0xFF303344), fontWeight = FontWeight.Black, fontSize = 19.sp)
    Spacer(Modifier.height(6.dp))
    OutlinedTextField(
        value = amount,
        onValueChange = { amount = it },
        label = { Text("Amount GBP") },
        prefix = { Text("GBP", color = Success, fontWeight = FontWeight.Black) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = fieldText,
            unfocusedTextColor = fieldText,
            focusedLabelColor = fieldLabel,
            unfocusedLabelColor = fieldLabel,
            focusedBorderColor = fieldFocus,
            unfocusedBorderColor = fieldBorder,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            cursorColor = fieldFocus,
        ),
    )
    Spacer(Modifier.height(6.dp))
    OutlinedTextField(
        value = message,
        onValueChange = { message = it },
        label = { Text("Message to dispatcher") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = fieldText,
            unfocusedTextColor = fieldText,
            focusedLabelColor = fieldLabel,
            unfocusedLabelColor = fieldLabel,
            focusedBorderColor = fieldFocus,
            unfocusedBorderColor = fieldBorder,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            cursorColor = fieldFocus,
        ),
    )
    Spacer(Modifier.height(8.dp))
    Button(
        onClick = { onSubmitQuote(amount, message) },
        enabled = parseFinitePositiveAmount(amount) != null && !isSubmitting,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Color(0xFF111217)),
        shape = RoundedCornerShape(999.dp),
    ) { Text("Submit Quote", fontWeight = FontWeight.Black) }
}

@Composable
private fun JobStatusPanel(job: DriverJob, onMoveStatus: (String) -> Unit, onSubmitQuote: (String, String) -> Unit, isSubmitting: Boolean = false) {
    XDriveCard {
        Text("Status History", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Spacer(Modifier.height(10.dp))
        if (job.isPosted()) {
            Text("This job is posted for driver quotes. Submit a quote; status workflow starts after the job is awarded.", color = TextSecondary, lineHeight = 20.sp)
            Spacer(Modifier.height(12.dp))
            QuoteBox(onSubmitQuote, isSubmitting)
        } else {
            StatusTimeline(job.driverStatusKey())
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { onMoveStatus(job.nextStatus()) },
                enabled = job.canMoveNext(),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
                shape = RoundedCornerShape(14.dp),
            ) { Text(job.nextActionLabel(), fontWeight = FontWeight.Bold) }
            job.blockingRequirementFor()?.let { requirement ->
                Text(requirement, color = Yellow, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }
            if (job.nextStatus() == "completed") {
                Text("Final step: complete after Delivered is confirmed.", color = TextSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}

@Composable
private fun PodPanel(
    job: DriverJob,
    onCapturePodPhoto: () -> Unit,
    onPickPodFile: () -> Unit,
    onConfirmDeliveryRecipient: (String) -> Unit,
) {
    val collectionStage = job.needsCollectionProof()
    var recipientName by remember(job.id, job.clientSignatureName) {
        mutableStateOf(job.clientSignatureName)
    }
    XDriveCard {
        Text(
            if (collectionStage) "Collection Proof" else "Proof of Delivery",
            color = TextPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
        )
        if (collectionStage) {
            Text(
                if (job.hasCollectionProof()) "Collection photo uploaded." else "A collection photo is required before Loaded.",
                color = TextSecondary,
            )
        } else {
            Text("POD files: ${job.podPhotos.size}", color = TextSecondary)
            Text("Delivery photos: ${job.deliveryPhotos.size}", color = TextSecondary)
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = onCapturePodPhoto,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
                shape = RoundedCornerShape(14.dp),
            ) { Text(if (collectionStage) "Take Collection Photo" else "Take POD Photo") }
            Button(
                onClick = onPickPodFile,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                shape = RoundedCornerShape(14.dp),
            ) { Text("Choose File") }
        }

        val attachments = if (collectionStage) {
            listOfNotNull(job.collectionPhotoUrl)
        } else {
            (job.podPhotos + job.deliveryPhotos).distinct()
        }
        if (attachments.isEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text(
                if (collectionStage) "No collection proof uploaded yet." else "No POD evidence uploaded yet.",
                color = TextSecondary,
            )
        } else {
            Spacer(Modifier.height(12.dp))
            Text("Attachments", color = TextPrimary, fontWeight = FontWeight.Bold)
            attachments.forEachIndexed { index, item ->
                InfoLine("File ${index + 1}", item.substringAfterLast('/'))
            }
        }

        if (!collectionStage && job.podRequired) {
            Spacer(Modifier.height(14.dp))
            Text("Recipient confirmation", color = TextPrimary, fontWeight = FontWeight.Bold)
            Text(
                "Enter the recipient name after the signed POD or delivery evidence has been uploaded.",
                color = TextSecondary,
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(10.dp))
            XDriveTextField(
                value = recipientName,
                onValueChange = { recipientName = it },
                label = "Recipient name",
                leading = "Sign",
            )
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = { onConfirmDeliveryRecipient(recipientName) },
                enabled = recipientName.isNotBlank() && job.hasPod(),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Success, contentColor = Navy),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text("Confirm Signed POD", fontWeight = FontWeight.Bold)
            }
            if (job.hasDeliveryConfirmation()) {
                Text(
                    "Recipient confirmed: ${job.clientSignatureName}",
                    color = Success,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun QuoteBox(onSubmitQuote: (String, String) -> Unit, isSubmitting: Boolean = false) {
    var amount by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    Text("Quote this job", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    Spacer(Modifier.height(10.dp))
    XDriveTextField(
        value = amount,
        onValueChange = { amount = it },
        label = "Amount GBP",
        leading = "GBP",
        keyboardType = KeyboardType.Number,
    )
    Spacer(Modifier.height(10.dp))
    XDriveTextField(
        value = message,
        onValueChange = { message = it },
        label = "Message to dispatcher",
        leading = "Msg",
    )
    Spacer(Modifier.height(10.dp))
    Button(
        onClick = { onSubmitQuote(amount, message) },
        enabled = parseFinitePositiveAmount(amount) != null && !isSubmitting,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
        shape = RoundedCornerShape(14.dp),
    ) { Text("Submit Quote", fontWeight = FontWeight.Bold) }
}

@Composable
private fun MessagesScreen(
    state: DriverUiState,
    onSendNote: (String, Boolean) -> Unit,
    onMarkRead: (String) -> Unit,
    onDelete: (String) -> Unit,
) {
    var filter by remember { mutableStateOf("All") }
    var note by remember { mutableStateOf("") }
    val visibleNotifications = state.notifications.filter { notification ->
        when (filter) {
            "Unread" -> notification.readAt.isNullOrBlank()
            "Important" -> notification.type.contains("important", ignoreCase = true) ||
                notification.title.contains("urgent", ignoreCase = true) ||
                notification.body.contains("urgent", ignoreCase = true)
            else -> true
        }
    }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { SegmentedTabs(listOf("All", "Unread", "Important"), filter) { filter = it } }
        if (visibleNotifications.isEmpty()) {
            item {
                EmptyState(
                    "No notifications",
                    "New dispatch, support and payment messages will appear here.",
                )
            }
        } else {
            items(visibleNotifications, key = { it.id }) { notification ->
                NotificationCard(notification, onMarkRead, onDelete)
            }
        }
        item {
            XDriveCard {
                Text("Dispatch Note", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                XDriveTextField(note, { note = it }, "Message", "Msg")
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { onSendNote(note, true); note = "" },
                    enabled = note.isNotBlank() && state.selectedJobId != null,
                    colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Send Important Note", fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun NotificationCard(
    notification: DriverNotification,
    onMarkRead: (String) -> Unit,
    onDelete: (String) -> Unit,
) {
    XDriveCard {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text(notification.title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                if (notification.body.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(notification.body, color = TextSecondary, fontSize = 13.sp, lineHeight = 18.sp)
                }
            }
            BadgeText(if (notification.readAt.isNullOrBlank()) "Unread" else "Read", if (notification.readAt.isNullOrBlank()) Yellow else Success)
        }
        Spacer(Modifier.height(8.dp))
        Text(
            listOf(notification.type, notification.createdAt?.marketplaceTime().orEmpty()).filter { it.isNotBlank() }.joinToString(" | "),
            color = TextSecondary,
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            if (notification.readAt.isNullOrBlank()) {
                Button(
                    onClick = { onMarkRead(notification.id) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                    shape = RoundedCornerShape(14.dp),
                ) { Text("Mark Read", fontWeight = FontWeight.Bold) }
            }
            Button(
                onClick = { onDelete(notification.id) },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Danger, contentColor = TextPrimary),
                shape = RoundedCornerShape(14.dp),
            ) { Text("Delete", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun ProfileScreen(
    state: DriverUiState,
    onUpdatePassword: (String) -> Unit,
    onLogout: () -> Unit,
    onPickComplianceDocument: (ComplianceDocOption) -> Unit,
    onSaveReturnJourney: (String, String, String) -> Unit,
    onStartTracking: () -> Unit,
    onStopTracking: () -> Unit,
) {
    var password by remember { mutableStateOf("") }
    var journeyFrom by remember(state.returnJourney?.id) { mutableStateOf(state.returnJourney?.fromLocation.orEmpty()) }
    var journeyTo by remember(state.returnJourney?.id) { mutableStateOf(state.returnJourney?.toLocation.orEmpty()) }
    var journeyDate by remember(state.returnJourney?.id) { mutableStateOf(state.returnJourney?.availableDate.orEmpty()) }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            XDriveCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(58.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Yellow, Blue))),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("XD", color = Navy, fontWeight = FontWeight.Black)
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            state.profile?.displayName?.ifBlank { "Driver" } ?: "Driver",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 19.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            state.profile?.email?.ifBlank { state.session?.email ?: "-" } ?: "-",
                            color = TextSecondary,
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    BadgeText("Active", Success)
                }
            }
        }
        item {
            XDriveCard {
                Text("Driver Information", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                InfoLine("Driver", state.profile?.displayName?.ifBlank { state.session?.email?.substringBefore("@") ?: "Driver" } ?: "Driver")
                InfoLine("Email", state.profile?.email?.ifBlank { state.session?.email ?: "-" } ?: "-")
                InfoLine("Company", "XDrive carrier account")
                InfoLine("Vehicle", state.profile?.vehicleLabel?.ifBlank { "Vehicle not linked" } ?: "Vehicle not linked")
                InfoLine("Registration", state.profile?.vehicleRegistration?.ifBlank { "Not set" } ?: "Not set")
                InfoLine("Status", "Active")
            }
        }
        item { AvailabilityPresencePanel(state.session) }
        item {
            XDriveCard {
                Text("Tracking", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Share live GPS with dispatch while you are working.", color = TextSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = onStartTracking,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Success, contentColor = Navy),
                        shape = RoundedCornerShape(14.dp),
                    ) { Text("Start", fontWeight = FontWeight.Bold) }
                    Button(
                        onClick = onStopTracking,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Danger, contentColor = TextPrimary),
                        shape = RoundedCornerShape(14.dp),
                    ) { Text("Stop", fontWeight = FontWeight.Bold) }
                }
            }
        }
        item {
            XDriveCard {
                Text("Journeys", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Save your next available route so backload matching can use it.", color = TextSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                XDriveTextField(journeyFrom, { journeyFrom = it }, "Going from", "From")
                Spacer(Modifier.height(10.dp))
                XDriveTextField(journeyTo, { journeyTo = it }, "Going to", "To")
                Spacer(Modifier.height(10.dp))
                XDriveTextField(journeyDate, { journeyDate = it }, "Available date/time", "Date")
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { onSaveReturnJourney(journeyFrom, journeyTo, journeyDate) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Success, contentColor = Navy),
                    shape = RoundedCornerShape(14.dp),
                ) { Text("Save Journey", fontWeight = FontWeight.Bold) }
            }
        }
        item {
            XDriveCard {
                Text("XDrive Pay", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                val pending = state.invoices.count { it.status.contains("pending", ignoreCase = true) || it.status.contains("submitted", ignoreCase = true) }
                val paid = state.invoices.count { it.status.contains("paid", ignoreCase = true) }
                val overdue = state.invoices.count { it.status.contains("overdue", ignoreCase = true) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    MiniQuoteMetric("Pending", pending.toString())
                    MiniQuoteMetric("Paid", paid.toString())
                    MiniQuoteMetric("Overdue", overdue.toString())
                }
                Spacer(Modifier.height(10.dp))
                if (state.invoices.isEmpty()) {
                    Text("No invoices found for this company yet.", color = TextSecondary, fontSize = 13.sp)
                } else {
                    state.invoices.take(3).forEach { invoice ->
                        InfoLine(
                            invoice.invoiceNumber,
                            listOf(invoice.status, invoice.amount?.let { "${invoice.currency} ${"%.2f".format(Locale.UK, it)}" }.orEmpty())
                                .filter { it.isNotBlank() }
                                .joinToString(" | ")
                        )
                    }
                }
            }
        }
        item {
            XDriveCard {
                Text("Documents", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                ComplianceDocumentOptions.forEach { option ->
                    DocumentRow(
                        option = option,
                        document = state.documents.latestFor(option),
                        onUpload = { onPickComplianceDocument(option) },
                    )
                }
            }
        }
        item {
            XDriveCard {
                Text("Security", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                XDriveTextField(password, { password = it }, "New password", "Lock", isPassword = true)
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { onUpdatePassword(password); password = "" },
                    enabled = password.length >= 8,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                    shape = RoundedCornerShape(14.dp),
                ) { Text("Change Password") }
            }
        }
        item {
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Danger, contentColor = TextPrimary),
                shape = RoundedCornerShape(14.dp),
            ) { Text("Logout", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun XDriveHeroMark() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("XD", color = Yellow, fontSize = 74.sp, fontWeight = FontWeight.Black)
            Box(
                modifier = Modifier
                    .padding(horizontal = 12.dp)
                    .width(2.dp)
                    .height(62.dp)
                    .background(Blue)
            )
            Column {
                Text("XDrive", color = Blue, fontSize = 35.sp, fontWeight = FontWeight.Black)
                Text("Logistics", color = Blue, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            }
        }
        Text("Delivering today. Driving tomorrow.", color = TextPrimary, fontSize = 15.sp)
    }
}

@Composable
private fun HeroDashboardCard(email: String, vehicle: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(listOf(Color(0xFF101C34), Color(0xFF071327))))
                .padding(18.dp)
        ) {
            Column {
                Text("Good day", color = TextSecondary, fontSize = 14.sp)
                Text(email.ifBlank { "XDrive Driver" }, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                Spacer(Modifier.height(8.dp))
                Text(vehicle, color = Yellow, fontSize = 14.sp)
            }
            Text("XD", color = Yellow.copy(alpha = 0.20f), fontSize = 82.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.CenterEnd))
        }
    }
}

@Composable
private fun XDriveTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    leading: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    trailing: String? = null,
    onTrailingClick: (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, color = TextSecondary) },
        leadingIcon = { Text(leading, color = Yellow, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp)) },
        trailingIcon = if (trailing != null) {
            { Text(trailing, color = TextSecondary, fontSize = 12.sp, modifier = Modifier.clickable { onTrailingClick?.invoke() }.padding(end = 10.dp)) }
        } else null,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary,
            focusedBorderColor = Yellow,
            unfocusedBorderColor = Border,
            focusedContainerColor = Navy2,
            unfocusedContainerColor = Navy2,
            cursorColor = Yellow,
        ),
    )
}

@Composable
private fun XDriveCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

@Composable
private fun JobCard(
    job: DriverJob,
    selected: Boolean,
    onClick: () -> Unit,
    onMoveStatus: (String) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
    onSave: (() -> Unit)? = null,
    onHide: (() -> Unit)? = null,
    onRestore: (() -> Unit)? = null,
    preferenceState: String? = null,
) {
    if (job.isPosted()) {
        PostedJobCard(
            job = job,
            selected = selected,
            onOpen = onClick,
            onSave = onSave,
            onHide = onHide,
            onRestore = onRestore,
            preferenceState = preferenceState,
        )
        return
    }

    XDriveCard {
        Column(Modifier.clickable(onClick = onClick)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(job.routeLabel(), color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Ref ${job.id.take(8).uppercase()}", color = TextSecondary, fontSize = 12.sp)
                }
                BadgeText(job.statusLabel(), if (job.driverStatusKey() in listOf("completed", "delivered")) Success else Blue)
            }
            Spacer(Modifier.height(12.dp))
            InfoLine("Pickup", job.pickupLocation.ifBlank { "-" })
            InfoLine("Delivery", job.deliveryLocation.ifBlank { "-" })
            InfoLine("Pickup time", job.pickupDatetime.driverDateTimeLabel())
            job.deliveryDatetime?.takeIf { it.isNotBlank() }?.let { InfoLine("Delivery time", it.driverDateTimeLabel()) }
            job.humanLoadLines().forEach { (label, value) -> InfoLine(label, value) }
            Spacer(Modifier.height(12.dp))
            if (job.isPosted()) {
                QuoteBox(onSubmitQuote)
            } else {
                StatusTimeline(job.driverStatusKey())
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { onMoveStatus(job.nextStatus()) },
                    enabled = job.canMoveNext(),
                    colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(job.nextActionLabel(), fontWeight = FontWeight.Bold) }
                if (job.nextStatus() == "delivered" && !job.hasPod()) {
                    Text("Upload POD before Delivered.", color = Yellow, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                }
            }
            if (selected) Text("Selected for POD and quick actions", color = Yellow, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

@Composable
private fun BottomNav(
    selected: DriverTab,
    activeCount: Int,
    unreadCount: Int,
    onTabChange: (DriverTab) -> Unit,
) {
    val tabs = primaryBottomNavTabs()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Navy2)
            .navigationBarsPadding()
            .padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEach { tab ->
            Column(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = XDriveTheme.BottomNavItemMinHeight)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (tab == selected) Color(0xFF17243F) else Color.Transparent)
                    .clickable { onTabChange(tab) }
                    .padding(vertical = 10.dp, horizontal = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    tab.navLabel(activeCount, unreadCount),
                    color = if (tab == selected) Yellow else TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = if (tab == selected) FontWeight.Bold else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

internal fun primaryBottomNavTabs(): List<DriverTab> = listOf(
    DriverTab.NEARBY,
    DriverTab.MESSAGES,
    DriverTab.QUOTES,
    DriverTab.JOBS,
    DriverTab.PROFILE,
)

internal fun primaryBottomNavLabels(activeCount: Int = 0, unreadCount: Int = 0): List<String> =
    primaryBottomNavTabs().map { it.navLabel(activeCount, unreadCount) }

@Composable
private fun LiveLoadsSegmentedTabs(
    selected: LiveLoadsBox,
    liveCount: Int,
    pinnedCount: Int,
    hiddenCount: Int,
    onSelected: (LiveLoadsBox) -> Unit,
) {
    val tabs = listOf(
        LiveLoadsBox.LIVE to "Live ($liveCount)",
        LiveLoadsBox.PINNED to "Pinned ($pinnedCount)",
        LiveLoadsBox.HIDDEN to "Hidden ($hiddenCount)",
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Navy2, RoundedCornerShape(22.dp))
            .padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEach { (tab, label) ->
            val active = selected == tab
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (active) Yellow else Color.Transparent)
                    .clickable { onSelected(tab) }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (active) Color(0xFF05070C) else TextSecondary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun SegmentedTabs(items: List<String>, selected: String, onSelected: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(items) { item ->
            val active = item == selected
            Surface(
                color = if (active) Yellow else Navy2,
                contentColor = if (active) Navy else TextPrimary,
                shape = RoundedCornerShape(999.dp),
                border = BorderStroke(1.dp, if (active) Yellow else Border),
                modifier = Modifier.clickable { onSelected(item) },
            ) {
                Text(item, modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp), fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
            }
        }
    }
}

@Composable
private fun StatusTimeline(status: String) {
    val steps = listOf(
        "posted",
        "allocated",
        "on_my_way",
        "on_site_pickup",
        "loaded",
        "in_transit",
        "on_site_delivery",
        "pod",
        "delivered",
        "completed",
    )
    val current = when (status) {
        "delivered" -> steps.indexOf("delivered")
        "completed" -> steps.indexOf("completed")
        else -> steps.indexOf(status).takeIf { it >= 0 } ?: 0
    }
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        steps.forEachIndexed { index, step ->
            val reached = if (step == "pod") status in listOf("delivered", "completed") else index <= current
            val isCurrent = step == status || (status == "delivered" && step == "delivered")
            val indicatorColor = when {
                reached && !isCurrent -> Success
                isCurrent -> Yellow
                else -> Border
            }
            val textColor = when {
                reached || isCurrent -> TextPrimary
                else -> TextSecondary
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(if (isCurrent) 12.dp else 10.dp)
                        .clip(CircleShape)
                        .background(indicatorColor)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    when {
                        reached && !isCurrent -> "Done - ${step.statusLabel()}"
                        isCurrent -> "Current - ${step.statusLabel()}"
                        else -> step.statusLabel()
                    },
                    color = textColor,
                    fontSize = 12.sp,
                    fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                )
            }
        }
    }
}

@Composable
private fun StatCard(label: String, count: Int, modifier: Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Navy2),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Border),
        modifier = modifier,
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(count.toString(), color = Yellow, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(label, color = TextSecondary, fontSize = 12.sp)
        }
    }
}

@Composable
private fun EmptyState(title: String, body: String) {
    XDriveCard {
        Text(title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Spacer(Modifier.height(6.dp))
        Text(body, color = TextSecondary, lineHeight = 20.sp)
    }
}

@Composable
private fun BadgeText(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.16f), contentColor = color, shape = RoundedCornerShape(999.dp), border = BorderStroke(1.dp, color.copy(alpha = 0.45f))) {
        Text(text, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ButtonSmall(text: String, onClick: () -> Unit) {
    Button(onClick = onClick, colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy), shape = RoundedCornerShape(12.dp)) {
        Text(text, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Spacer(Modifier.height(8.dp))
    Text(label, color = TextSecondary, fontSize = 12.sp)
    Text(value, color = TextPrimary, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

@Composable
private fun DocumentRow(option: ComplianceDocOption, document: DriverDocument?, onUpload: () -> Unit) {
    val isComplete = document?.status?.equals("approved", ignoreCase = true) == true && !document.expiryDate.isNullOrBlank()
    val statusColor = when {
        isComplete -> Success
        document?.status?.equals("approved", ignoreCase = true) == true -> Success
        document?.status?.equals("rejected", ignoreCase = true) == true -> Danger
        document != null -> Yellow
        else -> TextSecondary
    }
    Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(option.label, color = TextPrimary)
            Text(document.documentStatusText(), color = statusColor, fontSize = 12.sp, fontWeight = if (isComplete) FontWeight.Bold else FontWeight.Normal)
        }
        OutlinedButton(
            onClick = onUpload,
            enabled = true,
            shape = RoundedCornerShape(999.dp),
            border = BorderStroke(1.dp, if (isComplete) Success.copy(alpha = 0.75f) else Blue.copy(alpha = 0.75f)),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
        ) {
            Text(if (document == null) "Upload" else "Replace", color = if (isComplete) Success else Blue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}

@Composable
private fun DividerLabel(label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Box(Modifier.weight(1f).height(1.dp).background(Border))
        Text(label, color = TextSecondary, modifier = Modifier.padding(horizontal = 16.dp), fontSize = 12.sp)
        Box(Modifier.weight(1f).height(1.dp).background(Border))
    }
}

@Composable
private fun PostedJobCard(
    job: DriverJob,
    selected: Boolean,
    onOpen: () -> Unit,
    onSave: (() -> Unit)? = null,
    onHide: (() -> Unit)? = null,
    onRestore: (() -> Unit)? = null,
    preferenceState: String? = null,
) {
    var dragOffset by remember { mutableStateOf(0f) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(if (dragOffset >= 0f) Success.copy(alpha = 0.22f) else Danger.copy(alpha = 0.22f))
    ) {
        if (dragOffset > 18f) {
            Text(
                "Save",
                color = Success,
                fontWeight = FontWeight.Black,
                modifier = Modifier.align(Alignment.CenterStart).padding(start = 22.dp),
            )
        }
        if (dragOffset < -18f) {
            Text(
                "Delete",
                color = Danger,
                fontWeight = FontWeight.Black,
                modifier = Modifier.align(Alignment.CenterEnd).padding(end = 22.dp),
            )
        }
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFF9FAFC)),
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.dp, if (selected) Yellow else Color(0xFFE3E7EF)),
            modifier = Modifier
                .fillMaxWidth()
                .offset { IntOffset(dragOffset.roundToInt(), 0) }
                .pointerInput(preferenceState) {
                    detectDragGestures(
                        onDragEnd = {
                            when {
                                dragOffset > 110f -> {
                                    if (preferenceState == "deleted") onRestore?.invoke() else onSave?.invoke()
                                }
                                dragOffset < -110f -> onHide?.invoke()
                            }
                            dragOffset = 0f
                        },
                        onDragCancel = { dragOffset = 0f },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            dragOffset = (dragOffset + dragAmount.x).coerceIn(-180f, 180f)
                        },
                    )
                }
                .clickable(onClick = onOpen),
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                job.pickupDistanceFromActiveDeliveryMiles?.let { miles ->
                    PostedBadge(
                        "${"%.1f".format(Locale.UK, miles)} mi from delivery",
                        Color(0xFFEAF8EF),
                        Color(0xFF116B34),
                    )
                }

                PostedRouteBox(job)

                Button(
                    onClick = onOpen,
                    colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Color(0xFF111217)),
                    shape = RoundedCornerShape(999.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                ) {
                    Text(if (preferenceState == "deleted") "Restore / Details" else "Quote", fontWeight = FontWeight.Black, fontSize = 16.sp)
                }
                if (preferenceState == "saved") {
                    Text("Saved", color = Success, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                } else if (preferenceState == "deleted") {
                    Text("Deleted - swipe right to restore", color = Danger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                } else if (onSave != null || onHide != null) {
                    Text("Swipe right to save / left to delete", color = Color(0xFF6C6F7D), fontSize = 12.sp)
                }
                if (preferenceState == "deleted" && onRestore != null) {
                    OutlinedButton(
                        onClick = { onRestore.invoke() },
                        shape = RoundedCornerShape(999.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Restore", color = Blue, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun PostedBadge(label: String, background: Color, content: Color) {
    Surface(color = background, contentColor = content, shape = RoundedCornerShape(7.dp)) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
private fun PostedRouteBox(job: DriverJob) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0xFFE1E4EA)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                StopMarker("1", rounded = false)
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .height(24.dp)
                        .background(Color(0xFFD5DBE5)),
                )
                StopMarker("2", rounded = true)
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PostedStopLine(job.pickupLocation.locationHeadline(), job.pickupDatetime.marketplaceTime())
                PostedStopLine(job.deliveryLocation.locationHeadline(), job.deliveryDatetime.marketplaceDeliveryTime())
            }
        }
    }
}

@Composable
private fun StopMarker(number: String, rounded: Boolean) {
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(if (rounded) CircleShape else RoundedCornerShape(6.dp))
            .background(Color(0xFF4C9BE8)),
        contentAlignment = Alignment.Center,
    ) {
        Text(number, color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
    }
}

@Composable
private fun PostedStopLine(location: String, time: String) {
    Column {
        Text(
            location,
            color = Color(0xFF303344),
            fontWeight = FontWeight.Black,
            fontSize = 17.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(time, color = Color(0xFF6C6F7D), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private data class PostedBadgeSpec(val label: String, val color: Color, val textColor: Color)

private fun DriverJob.marketplaceTitle(): String =
    clientName
        .takeIf { it.isNotBlank() }
        ?.uppercase()
        ?: "XDRIVE POSTED JOB (${id.take(8).uppercase()})"

private fun DriverJob.marketplaceMeta(): String {
    val time = pickupDatetime.marketplaceShortDate()
    val vehicle = vehicleLabel()
    return listOf(time, vehicle, "Home location").filter { it.isNotBlank() }.joinToString(" | ")
}

private fun DriverJob.vehicleLabel(): String =
    loadDetails.extractLoadField("vehicle")
        ?: loadDetails.extractLoadField("vehicle_type")
        ?: loadDetails.extractLoadField("vehicleType")
        ?: loadDetails.extractLoadField("van")
        ?: "Vehicle TBC"

private fun DriverJob.distanceLabel(): String =
    distanceMiles?.let { String.format(Locale.UK, "%.1f miles", it) }
        ?: loadDetails.extractLoadField("distance")
        ?: loadDetails.extractLoadField("mileage")
        ?: loadDetails.extractLoadField("miles")?.let { "$it miles" }
        ?: "Distance TBC"

private fun DriverJob.termsLabel(): String =
    loadDetails.extractLoadField("terms")
        ?: loadDetails.extractLoadField("payment_terms")
        ?: "Terms TBC"

private fun DriverJob.phoneLabel(): String =
    clientPhone.takeIf { it.isNotBlank() }
        ?: loadDetails.extractLoadField("phone")
        ?: loadDetails.extractLoadField("telephone")
        ?: loadDetails.extractLoadField("contact_phone")
        ?: loadDetails.extractLoadField("contactPhone")
        ?: "Phone TBC"

private fun DriverJob.marketplaceBadges(): List<PostedBadgeSpec> {
    val details = loadDetails.lowercase()
    return buildList {
        add(PostedBadgeSpec("NEW", Color(0xFFE1F5DF), Color(0xFF238B31)))
        if ("backload" in details) add(PostedBadgeSpec("BACKLOAD", Color(0xFFE9F1FA), Color(0xFF2C74B8)))
        if ("hotshot" in details || "hot shot" in details) add(PostedBadgeSpec("HOTSHOT", Color(0xFFE9F1FA), Color(0xFF2C74B8)))
        if ("charge" in details || "charges" in details) add(PostedBadgeSpec("CHARGES", Color(0xFFF0F1F4), Color(0xFF303344)))
        add(PostedBadgeSpec("QUOTE", Color(0xFFFFF1A6), Color(0xFF3A3000)))
    }
}

private fun DriverJob.postedNote(): String =
    loadDetails
        .takeUnless { it.isBlank() || it.trimStart().startsWith("{") }
        ?.take(96)
        ?: ""

private fun String.locationHeadline(): String {
    if (isBlank()) return "LOCATION TBC"
    val parts = split(',').map { it.trim() }.filter { it.isNotBlank() }
    val city = parts.firstOrNull()?.uppercase().orEmpty()
    val postcodePart = parts.lastOrNull()?.uppercase().orEmpty()
    val outward = postcodePart.split(Regex("\\s+")).firstOrNull().orEmpty()
    return listOf(city, outward).filter { it.isNotBlank() }.joinToString(", ").ifBlank { uppercase() }
}

private fun String?.marketplaceShortDate(): String {
    val date = parseXDriveDateTime(this) ?: return "Time TBC"
    val local = date.atZoneSameInstant(ZoneId.systemDefault())
    val time = local.format(DateTimeFormatter.ofPattern("HH:mm"))
    val day = local.format(DateTimeFormatter.ofPattern("dd MMM", Locale.UK))
    return "$time | $day"
}

private fun String?.marketplaceTime(): String {
    val date = parseXDriveDateTime(this) ?: return "Time TBC"
    val local = date.atZoneSameInstant(ZoneId.systemDefault())
    return local.format(DateTimeFormatter.ofPattern("HH:mm 'BST' | dd MMM", Locale.UK))
}

private fun String?.marketplaceDeliveryTime(): String =
    parseXDriveDateTime(this)
        ?.atZoneSameInstant(ZoneId.systemDefault())
        ?.format(DateTimeFormatter.ofPattern("HH:mm 'BST' | dd MMM", Locale.UK))
        ?: "ASAP"

private fun String?.driverDateTimeLabel(): String {
    val date = parseXDriveDateTime(this) ?: return "Not set"
    val local = date.atZoneSameInstant(ZoneId.of("Europe/London"))
    val today = java.time.LocalDate.now(ZoneId.of("Europe/London"))
    val day = when (local.toLocalDate()) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        else -> local.format(DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.UK))
    }
    return "$day, ${local.format(DateTimeFormatter.ofPattern("HH:mm", Locale.UK))}"
}

private fun parseXDriveDateTime(value: String?): OffsetDateTime? =
    runCatching {
        value?.takeIf { it.isNotBlank() }?.let { OffsetDateTime.parse(it) }
    }.getOrNull()

private fun String.extractLoadField(key: String): String? {
    val quoted = Regex("\"$key\"\\s*:\\s*\"([^\"]+)\"", RegexOption.IGNORE_CASE).find(this)
    if (quoted != null) return quoted.groupValues.getOrNull(1)?.takeIf { it.isNotBlank() }
    val raw = Regex("\"$key\"\\s*:\\s*([^,}\\]]+)", RegexOption.IGNORE_CASE).find(this)
    return raw?.groupValues?.getOrNull(1)?.trim()?.trim('"')?.takeIf { it.isNotBlank() && it != "null" }
}

private fun DriverJob.humanLoadLines(): List<Pair<String, String>> {
    val details = loadDetails.trim()
    if (details.isBlank()) return emptyList()
    val fields = listOf(
        "Goods" to listOf("goods", "load", "cargo", "cargo_type", "freight", "description"),
        "Weight" to listOf("weight", "load_weight", "weight_kg"),
        "Quantity" to listOf("quantity", "qty", "pallets", "pieces"),
        "Notes" to listOf("notes", "note", "special_requirements", "requirements"),
    ).mapNotNull { (label, keys) ->
        keys.firstNotNullOfOrNull { key -> details.extractLoadField(key) }?.let { label to it }
    }
    if (fields.isNotEmpty()) return fields.distinctBy { it.first }
    return if (details.startsWith("{") || details.startsWith("[")) emptyList() else listOf("Load" to details.take(120))
}

private fun String.toDriverSafeError(): String {
    val lower = lowercase(Locale.UK)
    return when {
        isBlank() -> ""
        "unable to resolve host" in lower || "no address associated with hostname" in lower ->
            "Connection problem. Check internet signal and refresh."
        "violates check constraint" in lower || "relation" in lower || "sql" in lower || "postgres" in lower ->
            "The action could not be completed. Please refresh and try again."
        "status update could not be applied" in lower ->
            "The status could not be updated. Please refresh and try again."
        else -> this
    }
}

private fun DriverTab.screenTitle() = when (this) {
    DriverTab.NEARBY -> "Live Loads"
    DriverTab.QUOTES -> "Offers"
    DriverTab.BOOKINGS -> "Bookings"
    DriverTab.JOBS -> "Runs"
    DriverTab.SMARTPAY -> "XDrive Pay"
    DriverTab.ACTION -> "Job Details"
    DriverTab.MESSAGES -> "Updates"
    DriverTab.PROFILE -> "More"
}

private fun DriverUiState.headerTitle(): String {
    val selected = jobs.firstOrNull { it.id == selectedJobId }
    return if (selectedTab == DriverTab.ACTION && selected?.isPosted() == true) {
        "Load ID ${selected.id.take(8).uppercase()}"
    } else {
        selectedTab.screenTitle()
    }
}

private fun DriverTab.navLabel(activeCount: Int = 0, unreadCount: Int = 0) = when (this) {
    DriverTab.NEARBY -> "Loads"
    DriverTab.QUOTES -> "Offers"
    DriverTab.BOOKINGS -> "Bookings"
    DriverTab.JOBS -> if (activeCount > 0) "Runs $activeCount" else "Runs"
    DriverTab.SMARTPAY -> "Pay"
    DriverTab.ACTION -> "Job"
    DriverTab.MESSAGES -> unreadUpdatesLabel(unreadCount)
    DriverTab.PROFILE -> "More"
}

private fun DriverTab.navIcon(activeCount: Int) = when (this) {
    DriverTab.NEARBY -> "N"
    DriverTab.QUOTES -> "Q"
    DriverTab.BOOKINGS -> "B"
    DriverTab.JOBS -> if (activeCount > 0) activeCount.coerceAtMost(99).toString() else "J"
    DriverTab.SMARTPAY -> "£"
    DriverTab.ACTION -> "Q"
    DriverTab.MESSAGES -> "A"
    DriverTab.PROFILE -> "Me"
}

private fun String.statusLabel(): String =
    when (this) {
        "pod" -> "POD"
        "allocated" -> "Accepted"
        "on_my_way" -> "On My Way to Collection"
        "on_site_pickup" -> "Arrived at Collection"
        "loaded" -> "Loaded"
        "in_transit" -> "On My Way to Delivery"
        "on_site_delivery" -> "Arrived at Delivery"
        "delivered" -> "Delivered (POD)"
        "completed" -> "Completed"
        else -> split('_').joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } }
    }

private fun List<DriverDocument>.latestFor(option: ComplianceDocOption): DriverDocument? {
    val target = option.docType.normalizeDocType()
    return firstOrNull { it.isVehicleDocument == option.isVehicleDocument && it.docType.normalizeDocType() == target }
        ?: firstOrNull { it.isVehicleDocument == option.isVehicleDocument && it.docType.normalizeDocType().contains(target) }
}

private fun String.normalizeDocType(): String =
    lowercase(Locale.UK).replace(Regex("[^a-z0-9]+"), "")

private fun String.documentStatusLabel(): String =
    when (lowercase(Locale.UK)) {
        "pending" -> "Pending review"
        "approved" -> "Approved"
        "rejected" -> "Rejected"
        "expired" -> "Expired"
        else -> statusLabel()
    }

private fun DriverDocument?.documentStatusText(): String {
    if (this == null) return "Not uploaded"
    val expiry = expiryDate?.takeIf { it.isNotBlank() }
    return if (status.equals("approved", ignoreCase = true) && expiry != null) {
        "Complete - expires ${expiry.toUkDateLabel()}"
    } else if (expiry != null) {
        "${status.documentStatusLabel()} - expires ${expiry.toUkDateLabel()}"
    } else {
        status.documentStatusLabel()
    }
}

private fun String.toUkDateLabel(): String =
    runCatching {
        val parts = split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else this
    }.getOrDefault(this)

private fun MainActivity.hasForegroundLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    return fine || coarse
}

private fun MainActivity.trackingRuntimePermissions(includeNotifications: Boolean = true): Array<String> =
    buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (includeNotifications && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

private fun MainActivity.createPodPhotoUri(): Uri {
    val podDir = File(cacheDir, "pod").apply { mkdirs() }
    val photo = File.createTempFile("xdrive-pod-", ".jpg", podDir)
    return FileProvider.getUriForFile(
        this,
        "co.uk.xdrivelogistics.driver.fileprovider",
        photo,
    )
}

private fun MainActivity.displayName(uri: Uri): String? {
    return runCatching {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }
    }.getOrNull()?.takeIf { it.isNotBlank() }
}
