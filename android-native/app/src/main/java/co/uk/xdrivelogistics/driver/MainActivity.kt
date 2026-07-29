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
import co.uk.xdrivelogistics.driver.data.DriverAvailability
import co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus
import co.uk.xdrivelogistics.driver.data.DriverAvailabilitySlot
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DispatcherMessage
import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
import com.google.android.gms.location.LocationServices
import com.google.firebase.messaging.FirebaseMessaging
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private val Navy = Color(0xFF070B14)
private val Navy2 = Color(0xFF0D1424)
private val Panel = Color(0xFF131D33)
private val Border = Color(0xFF24324D)
private val Blue = Color(0xFF0057D9)
private val Yellow = Color(0xFFFFD200)
private val TextPrimary = Color(0xFFF8FAFC)
private val TextSecondary = Color(0xFFA9B7D0)
private val Danger = Color(0xFFFF5C7A)
private val Success = Color(0xFF25D987)

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
        handleIncomingIntent(intent)
        if (ensureFirebaseAppInitialized(applicationContext)) {
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (!token.isNullOrBlank()) {
                        viewModel.registerDeviceToken(token)
                    }
                }
        }
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

                // Standalone notification permission launcher: requests POST_NOTIFICATIONS
                // independently of location so a driver who never starts tracking still receives
                // push notifications. Denial is silent — login and all other operations proceed.
                val notificationPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { /* result is informational only; no blocking on denial */ }

                // Request POST_NOTIFICATIONS once per authenticated session, independently of
                // location or tracking flow. Pre-Android-13 devices do not need this request.
                LaunchedEffect(state.isAuthenticated) {
                    if (state.isAuthenticated &&
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.POST_NOTIFICATIONS,
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
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
                            onMarketplaceJobSelected = viewModel::selectMarketplaceLoad,
                            onLogout = viewModel::logout,
                            onRefresh = viewModel::refreshDriverData,
                            onSendNote = viewModel::sendQuickNote,
                            onSubmitQuote = viewModel::submitQuoteForSelectedJob,
                            onUpdatePassword = viewModel::updatePassword,
                            onJobPreference = viewModel::setJobSearchPreference,
                            onMoveStatus = viewModel::moveSelectedJobTo,
                            onMarkMessageRead = viewModel::markDispatcherMessageRead,
                            onMarkAllMessagesRead = viewModel::markAllDispatcherMessagesRead,
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
                                    locationPermissionLauncher.launch(trackingRuntimePermissions())
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
                            onLoadMoreMessages = viewModel::loadMoreDispatcherMessages,
                            onOpenJobFromMessage = { jobId ->
                                viewModel.selectJob(jobId)
                                viewModel.changeTab(DriverTab.JOBS)
                            },
                            onNoteChange = viewModel::setDispatchNoteDraft,
                            onSetAvailabilityStatus = viewModel::setAvailabilityStatus,
                            onToggleAvailabilitySlot = viewModel::toggleAvailabilitySlot,
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        val data = intent?.data ?: return
        val destination = XDriveDeepLink.parse(data)
        viewModel.handleDeepLink(destination)
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
    var rememberMe by remember { mutableStateOf(true) }
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
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = rememberMe,
                    onCheckedChange = { rememberMe = it },
                    colors = CheckboxDefaults.colors(
                        checkedColor = Yellow,
                        uncheckedColor = Border,
                        checkmarkColor = Navy,
                    )
                )
                Text("Remember me", color = TextPrimary)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { }) { Text("Forgot password?", color = Yellow) }
            }
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
        item { DividerLabel("OR") }
        item {
            OutlinedButton(
                onClick = { },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Border),
            ) {
                Text("Fingerprint", color = Yellow)
                Spacer(Modifier.width(12.dp))
                Text("Log in with Biometrics", color = TextPrimary, fontSize = 16.sp)
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
    onMarketplaceJobSelected: (String) -> Unit,
    onLogout: () -> Unit,
    onRefresh: () -> Unit,
    onSendNote: (String, Boolean) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
    onUpdatePassword: (String) -> Unit,
    onJobPreference: (String, String?) -> Unit,
    onMoveStatus: (String) -> Unit,
    onMarkMessageRead: (String) -> Unit,
    onMarkAllMessagesRead: () -> Unit,
    onLoadMoreMessages: () -> Unit,
    onOpenJobFromMessage: (String) -> Unit,
    onNoteChange: (String) -> Unit,
    onSaveReturnJourney: (String, String, String) -> Unit,
    onConfirmDeliveryRecipient: (String) -> Unit,
    onStartTracking: () -> Unit,
    onStopTracking: () -> Unit,
    onPublishLocation: () -> Unit,
    onPickPodFile: () -> Unit,
    onPickComplianceDocument: (ComplianceDocOption) -> Unit,
    onCapturePodPhoto: () -> Unit,
    onNavigateTo: (String) -> Unit,
    onSetAvailabilityStatus: (DriverAvailabilityStatus) -> Unit,
    onToggleAvailabilitySlot: (Int, String, Boolean) -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Navy)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        AppHeader(
            title = state.headerTitle(),
            isLoading = state.isLoading,
            onRefresh = onRefresh,
        )

        Box(modifier = Modifier.weight(1f)) {
            when (state.selectedTab) {
                DriverTab.NEARBY -> NearbyJobsScreen(state, onMarketplaceJobSelected, onTabChange, onJobPreference)
                DriverTab.QUOTES -> MyQuotesScreen(state)
                DriverTab.BOOKINGS -> BookingsScreen(state, onJobSelected, onTabChange)
                DriverTab.JOBS -> MyJobsScreen(state, onJobSelected, onTabChange, onMoveStatus, onSubmitQuote)
                DriverTab.SMARTPAY -> SmartPayScreen(state)
                DriverTab.ACTION -> ActionScreen(
                    state = state,
                    onJobSelected = onJobSelected,
                    onSendNote = onSendNote,
                    onSubmitQuote = onSubmitQuote,
                    onPickPodFile = onPickPodFile,
                    onCapturePodPhoto = onCapturePodPhoto,
                    onConfirmDeliveryRecipient = onConfirmDeliveryRecipient,
                    onMoveStatus = onMoveStatus,
                    onNavigateTo = onNavigateTo,
                )
                DriverTab.MESSAGES -> MessagesScreen(
                    state = state,
                    onSendNote = onSendNote,
                    onMarkRead = onMarkMessageRead,
                    onMarkAllRead = onMarkAllMessagesRead,
                    onLoadMore = onLoadMoreMessages,
                    onOpenJob = onOpenJobFromMessage,
                    onNoteChange = onNoteChange,
                )
                DriverTab.PROFILE -> ProfileScreen(state, onUpdatePassword, onLogout, onPickComplianceDocument, onSaveReturnJourney, onStartTracking, onStopTracking, onSetAvailabilityStatus, onToggleAvailabilitySlot)
            }
        }

        BottomNav(state.selectedTab, state.jobs.count { it.isActive() }, state.dispatcherUnreadCount, onTabChange)
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
    onMarketplaceJobSelected: (String) -> Unit,
    onTabChange: (DriverTab) -> Unit,
    onJobPreference: (String, String?) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var box by remember { mutableStateOf("Inbox") }
    var sort by remember { mutableStateOf("Nearest") }
    var radius by remember { mutableStateOf("20") }
    var vehicleFilter by remember { mutableStateOf("") }
    var freightFilter by remember { mutableStateOf("") }
    var dateFilter by remember { mutableStateOf("") }
    var memberFilter by remember { mutableStateOf("") }

    val activeDeliveryJob = state.jobs.firstOrNull {
        !it.isPosted() && it.isActive() && it.deliveryPostcode.isNotBlank()
    }
    val bidJobIds = state.bids.map { it.jobId }.toSet()
    val marketplaceJobs = state.marketplaceJobs
    val radiusMiles = radius.toDoubleOrNull()

    val boxedJobs = marketplaceJobs.filter { job ->
        val pref = state.jobSearchPreferences[job.id]
        when (box) {
            "Saved" -> pref == "saved"
            "Deleted" -> pref == "deleted"
            else -> pref != "deleted" && job.id !in bidJobIds
        }
    }.filter { job ->
        radiusMiles == null || job.distanceSortKey() <= radiusMiles
    }.filter { job ->
        vehicleFilter.isBlank() || job.vehicleType.orEmpty().contains(vehicleFilter.trim(), ignoreCase = true)
    }.filter { job ->
        freightFilter.isBlank() || job.freightType.orEmpty().contains(freightFilter.trim(), ignoreCase = true)
    }.filter { job ->
        dateFilter.isBlank() || job.pickupCollectionFrom.orEmpty().contains(dateFilter.trim(), ignoreCase = true)
    }.filter { job ->
        memberFilter.isBlank() ||
            job.posterCompanyName.orEmpty().contains(memberFilter.trim(), ignoreCase = true) ||
            job.id.contains(memberFilter.trim(), ignoreCase = true)
    }
    val searched = boxedJobs.filter {
        val needle = query.trim().lowercase()
        needle.isBlank() ||
            it.id.lowercase().contains(needle) ||
            it.publicReference.lowercase().contains(needle) ||
            it.pickupPostcode.lowercase().contains(needle) ||
            it.deliveryPostcode.lowercase().contains(needle) ||
            it.pickupAddressSummary.lowercase().contains(needle) ||
            it.deliveryAddressSummary.lowercase().contains(needle) ||
            it.freightType.orEmpty().lowercase().contains(needle)
    }
    val filtered = when (sort) {
        "Newest" -> searched.sortedByDescending { it.pickupCollectionFrom.orEmpty() }
        "Highest Value" -> searched.sortedByDescending { it.proposedPriceGbp ?: 0.0 }
        "Priority" -> searched.sortedWith(compareByDescending<MarketplaceJob> { it.destinationPriority }.thenBy { it.distanceSortKey() })
        else -> searched.sortedBy { it.distanceSortKey() }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            XDriveCard {
                Text("Live Loads", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text(
                    if (activeDeliveryJob != null) {
                        "${filtered.size} loads near ${activeDeliveryJob.deliveryPostcode.take(4).trim()}"
                    } else {
                        "${filtered.size} loads available"
                    },
                    color = TextSecondary,
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    if (activeDeliveryJob != null) BadgeText("Backload", Yellow)
                    BadgeText("${radius}mi radius", Blue)
                    BadgeText("Live", Success)
                }
            }
        }
        if (state.nearbyDrivers.isNotEmpty()) {
            item {
                XDriveCard {
                    Text("Who's Nearby", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("${state.nearbyDrivers.size} tracked drivers", color = TextSecondary, fontSize = 13.sp)
                    Spacer(Modifier.height(10.dp))
                    state.nearbyDrivers.take(5).forEach { nearby ->
                        InfoLine(
                            nearby.driverName,
                            listOf(
                                nearby.vehicleLabel,
                                nearby.lat?.let { lat -> nearby.lng?.let { lng -> "%.4f, %.4f".format(Locale.UK, lat, lng) } }.orEmpty(),
                                nearby.recordedAt?.marketplaceTime().orEmpty(),
                            ).filter { it.isNotBlank() }.joinToString(" | ")
                        )
                    }
                }
            }
        }
        item {
            SegmentedTabs(listOf("Inbox", "Saved", "Deleted"), box) { box = it }
        }
        item {
            XDriveTextField(query, { query = it }, "Search loads", "Find")
        }
        item {
            XDriveCard {
                Text("Filters", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { XDriveTextField(radius, { radius = it }, "Radius miles", "Mi", keyboardType = KeyboardType.Number) }
                    Box(Modifier.weight(1f)) { XDriveTextField(vehicleFilter, { vehicleFilter = it }, "Vehicle", "Van") }
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { XDriveTextField(freightFilter, { freightFilter = it }, "Freight", "Load") }
                    Box(Modifier.weight(1f)) { XDriveTextField(dateFilter, { dateFilter = it }, "Date", "Date") }
                }
                Spacer(Modifier.height(10.dp))
                XDriveTextField(memberFilter, { memberFilter = it }, "Member / ID", "ID")
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        query = ""
                        radius = "20"
                        vehicleFilter = ""
                        freightFilter = ""
                        dateFilter = ""
                        memberFilter = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Clear Filters", fontWeight = FontWeight.Bold) }
            }
        }
        item {
            SegmentedTabs(listOf("Nearest", "Priority", "Newest", "Highest Value"), sort) { sort = it }
        }
        if (filtered.isEmpty()) {
            item {
                EmptyState(
                    "No loads found.",
                    if (activeDeliveryJob != null) {
                        "No matching loads within ${radius} miles of the current delivery postcode."
                    } else {
                        "Adjust filters or refresh to see available loads."
                    },
                )
            }
        }
        items(filtered, key = { it.id }) { job ->
            MarketplaceJobCard(
                job = job,
                alreadyBid = job.id in bidJobIds,
                preferenceState = state.jobSearchPreferences[job.id],
                onTap = {
                    onMarketplaceJobSelected(job.id)
                    onTabChange(DriverTab.ACTION)
                },
                onSave = { onJobPreference(job.id, "saved") },
                onHide = { onJobPreference(job.id, "deleted") },
                onRestore = { onJobPreference(job.id, null) },
            )
        }
    }
}

@Composable
private fun MarketplaceJobCard(
    job: MarketplaceJob,
    alreadyBid: Boolean,
    preferenceState: String?,
    onTap: () -> Unit,
    onSave: () -> Unit,
    onHide: () -> Unit,
    onRestore: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (job.destinationPriority) Color(0xFF0A1E3D) else Panel,
        ),
        border = if (job.destinationPriority) BorderStroke(1.dp, Blue) else BorderStroke(1.dp, Border),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onTap),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(job.publicReference, color = TextSecondary, fontSize = 11.sp)
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "${job.pickupAddressSummary} → ${job.deliveryAddressSummary}",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                }
                if (job.hasProposedPrice && job.proposedPriceGbp != null) {
                    Column(horizontalAlignment = Alignment.End) {
                        Text("£%.2f".format(job.proposedPriceGbp), color = Yellow, fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text("proposed", color = TextSecondary, fontSize = 10.sp)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                if (job.destinationPriority) BadgeText("Priority", Blue)
                if (alreadyBid) BadgeText("Bid sent", Success)
                if (!job.canQuote) BadgeText("Ineligible", Danger)
                if (job.vehicleType != null) BadgeText(job.vehicleLabel(), Border)
            }
            val cargo = job.cargoSummary()
            if (cargo.isNotBlank() || job.shortDistanceLabel().isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (cargo.isNotBlank()) InfoLine("Freight", cargo)
                    if (job.shortDistanceLabel().isNotBlank()) InfoLine("Distance", job.shortDistanceLabel())
                }
            }
            job.pickupCollectionFrom?.let { time ->
                val label = time.marketplaceTime()
                if (label.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text("Collection: $label", color = TextSecondary, fontSize = 12.sp)
                }
            }
            if (!job.canQuote && job.quoteWarning != null) {
                Spacer(Modifier.height(4.dp))
                Text(job.quoteWarning, color = Danger, fontSize = 11.sp)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                when (preferenceState) {
                    "saved" -> ButtonSmall("Restore") { onRestore() }
                    "deleted" -> ButtonSmall("Restore") { onRestore() }
                    else -> {
                        ButtonSmall("Save") { onSave() }
                        ButtonSmall("Hide") { onHide() }
                    }
                }
            }
        }
    }
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
    val isPaid = invoice.paymentStatus?.contains("paid", true) == true ||
        invoice.status.contains("paid", true)
    XDriveCard {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text(invoice.invoiceNumber, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 17.sp)
                Text(invoice.clientName.ifBlank { "Client TBC" }, color = TextSecondary, fontSize = 13.sp)
            }
            Column(horizontalAlignment = Alignment.End) {
                BadgeText(
                    invoice.paymentStatus?.replaceFirstChar { it.uppercase() }
                        ?: invoice.status.ifBlank { "Draft" },
                    if (isPaid) Success else Yellow,
                )
                invoice.issuedAt?.marketplaceTime()?.let { t ->
                    Text(t, color = TextSecondary, fontSize = 11.sp)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        InfoLine("Total", invoice.amount?.let { "${invoice.currency} ${"%.2f".format(Locale.UK, it)}" } ?: "TBC")
        if (invoice.netAmount != null) InfoLine("Net", "${invoice.currency} ${"%.2f".format(Locale.UK, invoice.netAmount)}")
        if (invoice.vatAmount != null) InfoLine("VAT", "${invoice.currency} ${"%.2f".format(Locale.UK, invoice.vatAmount)}")
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
    onJobSelected: (String) -> Unit,
    onSendNote: (String, Boolean) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
    onPickPodFile: () -> Unit,
    onCapturePodPhoto: () -> Unit,
    onConfirmDeliveryRecipient: (String) -> Unit,
    onMoveStatus: (String) -> Unit,
    onNavigateTo: (String) -> Unit,
) {
    val actionTargets = resolveActionScreenTargets(
        jobs = state.jobs,
        selectedJobId = state.selectedJobId,
        marketplaceJobs = state.marketplaceJobs,
        marketplaceSelectedJobId = state.marketplaceSelectedJobId,
    )
    val selected = actionTargets.operationalJob
    val marketplaceJob = actionTargets.marketplaceJob
    val activeJobs = state.jobs.filter { !it.isPosted() && it.isActive() }
    var note by remember { mutableStateOf("") }
    var important by remember { mutableStateOf(false) }
    var detailTab by remember { mutableStateOf("Summary") }

    if (selected?.isPosted() == true || marketplaceJob != null) {
        PostedJobDetailScreen(
            job = selected,
            marketplaceJob = marketplaceJob,
            statusMessage = state.message,
            errorMessage = state.error,
            onSubmitQuote = onSubmitQuote,
            onSendMessage = {
                val ref = (selected?.id ?: marketplaceJob?.id ?: "").take(8).uppercase()
                onSendNote("Message requested for $ref", true)
            },
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
            ActiveJobsSelectorCard(
                jobs = activeJobs,
                selectedJobId = state.selectedJobId,
                syncStates = state.jobSyncStates,
                onSelectJob = onJobSelected,
            )
        }
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
            item { EmptyState("No job selected.", "Choose an active job from the selector to continue.") }
        } else {
            when (detailTab) {
                "Summary" -> item { JobSummaryPanel(selected, onSubmitQuote) }
                "Stops" -> item { JobStopsPanel(selected, onNavigateTo) }
                "Status" -> item { JobStatusPanel(selected, state.jobSyncStates[selected.id], onMoveStatus, onSubmitQuote) }
                "POD" -> item {
                    PodPanel(
                        selected,
                        onCapturePodPhoto,
                        onPickPodFile,
                        onConfirmDeliveryRecipient,
                        hasPendingEvidence = selected.id in state.pendingPodJobIds,
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
private fun ActiveJobsSelectorCard(
    jobs: List<DriverJob>,
    selectedJobId: String?,
    syncStates: Map<String, DriverJobSyncState>,
    onSelectJob: (String) -> Unit,
) {
    XDriveCard {
        Text("Active Jobs", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        if (jobs.isEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text("No active jobs available. Select a posted load from Nearby when work is awarded.", color = TextSecondary, fontSize = 13.sp)
            return@XDriveCard
        }
        Spacer(Modifier.height(10.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(jobs, key = { it.id }) { job ->
                val selected = job.id == selectedJobId
                val localSync = syncStates[job.id]
                Card(
                    modifier = Modifier
                        .width(240.dp)
                        .clickable { onSelectJob(job.id) },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = if (selected) Blue.copy(alpha = 0.22f) else Navy2),
                    border = BorderStroke(1.dp, if (selected) Yellow else Border),
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(job.routeLabel(), color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(job.pickupDatetime.marketplaceTime(), color = TextSecondary, fontSize = 12.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            BadgeText(job.statusLabel(), Blue)
                            BadgeText(localSync?.state?.syncLabel() ?: "Synced", localSync?.state?.syncColor() ?: Success)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun JobSummaryPanel(job: DriverJob, onSubmitQuote: (String, String) -> Unit) {
    XDriveCard {
        Text("Summary", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        InfoLine("Job Ref", job.id.take(12).uppercase())
        InfoLine("Customer", job.clientName.ifBlank { "Assigned by dispatch" })
        InfoLine("Goods / Details", job.loadDetails.ifBlank { "No load details supplied." })
        InfoLine("Collection Time", job.pickupDatetime ?: "Not set")
        InfoLine("Delivery Time", job.deliveryDatetime ?: "Not set")
        if (job.pallets != null && job.pallets > 0) InfoLine("Pallets", "${job.pallets}")
        if (job.weightKg != null && job.weightKg > 0) InfoLine("Weight", "${job.weightKg.toInt()} kg")
        if (job.estimatedDurationMinutes != null && job.estimatedDurationMinutes > 0) InfoLine("Est. Duration", "${job.estimatedDurationMinutes} min")
        if (job.specialRequirements.isNotBlank()) InfoLine("Requirements", job.specialRequirements)
        if (job.accessRestrictions.isNotBlank()) InfoLine("Access", job.accessRestrictions)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            BadgeText(if (job.pickupDatetime != null) "Timed" else "Flexible", Blue)
            BadgeText(if (job.hasPod()) "POD Uploaded" else "POD Required", if (job.hasPod()) Success else Yellow)
        }
        if (job.isPosted()) {
            Spacer(Modifier.height(14.dp))
            QuoteBox(onSubmitQuote)
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
            contact = job.collectionContactName?.ifBlank { null } ?: job.clientName.ifBlank { "Dispatch contact" },
            phone = job.collectionContactPhone?.ifBlank { null } ?: job.clientPhone.ifBlank { null },
            button = "Navigate Pickup",
            onNavigate = { if (job.pickupLocation.isNotBlank()) onNavigateTo(job.pickupLocation) },
        )
        StopCard(
            number = "2",
            title = "Delivery",
            address = job.deliveryLocation.ifBlank { "Delivery address not supplied" },
            time = job.deliveryDatetime ?: "Time not set",
            contact = job.deliveryContactName?.ifBlank { null } ?: "Recipient / site contact",
            phone = job.deliveryContactPhone?.ifBlank { null },
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
    phone: String?,
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
        if (!phone.isNullOrBlank()) InfoLine("Phone", phone)
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
    job: DriverJob?,
    marketplaceJob: MarketplaceJob?,
    statusMessage: String,
    errorMessage: String,
    onSubmitQuote: (String, String) -> Unit,
    onSendMessage: (() -> Unit)?,
) {
    val ref = job?.id?.take(8)?.uppercase() ?: marketplaceJob?.publicReference ?: "LOAD"
    val canQuote = marketplaceJob?.canQuote ?: true
    val quoteWarning = marketplaceJob?.quoteWarning
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
                "Load $ref",
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

        if (job != null) {
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
            item {
                LightDetailCard {
                    DetailRow("V", "VEHICLE", job.vehicleLabel())
                    Spacer(Modifier.height(18.dp))
                    DetailRow("M", "DISTANCE", job.distanceLabel())
                    if (job.pallets != null && job.pallets > 0) {
                        Spacer(Modifier.height(12.dp))
                        DetailRow("P", "PALLETS", "${job.pallets}")
                    }
                    if (job.weightKg != null && job.weightKg > 0) {
                        Spacer(Modifier.height(12.dp))
                        DetailRow("W", "WEIGHT", "${job.weightKg.toInt()} kg")
                    }
                    if (job.estimatedDurationMinutes != null && job.estimatedDurationMinutes > 0) {
                        Spacer(Modifier.height(12.dp))
                        DetailRow("T", "DURATION", "${job.estimatedDurationMinutes} min")
                    }
                    if (job.specialRequirements.isNotBlank()) {
                        Spacer(Modifier.height(12.dp))
                        DetailRow("!", "REQUIREMENTS", job.specialRequirements)
                    }
                    if (job.accessRestrictions.isNotBlank()) {
                        Spacer(Modifier.height(12.dp))
                        DetailRow("A", "ACCESS", job.accessRestrictions)
                    }
                }
            }
        } else if (marketplaceJob != null) {
            item {
                LightDetailCard {
                    Text(
                        "${marketplaceJob.pickupAddressSummary} → ${marketplaceJob.deliveryAddressSummary}",
                        color = Color(0xFF303344),
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                    )
                    marketplaceJob.pickupCollectionFrom?.let {
                        Spacer(Modifier.height(6.dp))
                        Text("Collection: ${it.marketplaceTime()}", color = Color(0xFF6C6F7D), fontSize = 13.sp)
                    }
                    if (marketplaceJob.vehicleType != null || marketplaceJob.freightType != null || marketplaceJob.pallets != null) {
                        Spacer(Modifier.height(10.dp))
                        if (marketplaceJob.vehicleType != null) DetailRow("V", "VEHICLE", marketplaceJob.vehicleLabel())
                        val cargo = marketplaceJob.cargoSummary()
                        if (cargo.isNotBlank()) {
                            Spacer(Modifier.height(10.dp))
                            DetailRow("F", "FREIGHT", cargo)
                        }
                        if (marketplaceJob.journeyDistanceMiles != null) {
                            Spacer(Modifier.height(10.dp))
                            DetailRow("M", "DISTANCE", "%.1f mi".format(marketplaceJob.journeyDistanceMiles))
                        }
                    }
                    if (marketplaceJob.destinationPriority) {
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            BadgeText("Priority backload", Color(0xFF0057D9))
                            marketplaceJob.distanceFromCurrentDeliveryMiles?.let { d ->
                                BadgeText("%.1f mi away".format(d), Color(0xFF24324D))
                            }
                        }
                    }
                }
            }
        }

        item {
            LightDetailCard(contentPadding = 14.dp) {
                val companyName = job?.clientName?.ifBlank { null }
                    ?: marketplaceJob?.posterCompanyName
                if (!companyName.isNullOrBlank()) {
                    DetailRow("C", "POSTED BY", companyName)
                    Spacer(Modifier.height(12.dp))
                }
                if (job != null && onSendMessage != null) {
                    Button(
                        onClick = onSendMessage,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4C9BE8), contentColor = Color.White),
                        shape = RoundedCornerShape(999.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                    ) { Text("Message Dispatcher", fontWeight = FontWeight.Black, fontSize = 15.sp) }
                }
            }
        }

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
                if (!canQuote && !quoteWarning.isNullOrBlank()) {
                    QuoteStatusBanner(
                        title = "Bidding unavailable",
                        body = quoteWarning,
                        isError = true,
                    )
                } else {
                    QuoteBoxLight(
                        proposedPriceGbp = marketplaceJob?.proposedPriceGbp,
                        onSubmitQuote = onSubmitQuote,
                    )
                }
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
private fun QuoteBoxLight(
    proposedPriceGbp: Double?,
    onSubmitQuote: (String, String) -> Unit,
) {
    var amount by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var showCustom by remember { mutableStateOf(false) }
    val fieldText = Color(0xFF202231)
    val fieldLabel = Color(0xFF7B7D8A)
    val fieldBorder = Color(0xFF8E919B)
    val fieldFocus = Color(0xFF4D9BE8)
    Text("Submit quote", color = Color(0xFF303344), fontWeight = FontWeight.Black, fontSize = 19.sp)
    Spacer(Modifier.height(6.dp))
    if (proposedPriceGbp != null && proposedPriceGbp > 0.0 && !showCustom) {
        Button(
            onClick = { onSubmitQuote("%.2f".format(proposedPriceGbp), "") },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF116B34), contentColor = Color.White),
            shape = RoundedCornerShape(999.dp),
        ) { Text("Accept £${"%.2f".format(proposedPriceGbp)}", fontWeight = FontWeight.Black, fontSize = 16.sp) }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = { showCustom = true },
            modifier = Modifier.fillMaxWidth().height(44.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF0F3F8), contentColor = Color(0xFF303344)),
            shape = RoundedCornerShape(999.dp),
        ) { Text("Enter different amount", fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
    } else {
        if (proposedPriceGbp != null && proposedPriceGbp > 0.0) {
            OutlinedButton(
                onClick = { showCustom = false },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(999.dp),
            ) { Text("← Back to proposed price", fontSize = 13.sp) }
            Spacer(Modifier.height(8.dp))
        }
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
            enabled = amount.toDoubleOrNull()?.let { it > 0.0 } == true,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Color(0xFF111217)),
            shape = RoundedCornerShape(999.dp),
        ) { Text("Submit Quote", fontWeight = FontWeight.Black) }
    }
}

@Composable
private fun JobStatusPanel(
    job: DriverJob,
    localSyncState: DriverJobSyncState?,
    onMoveStatus: (String) -> Unit,
    onSubmitQuote: (String, String) -> Unit,
) {
    XDriveCard {
        Text("Status History", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Spacer(Modifier.height(10.dp))
        if (job.isPosted()) {
            Text("This job is posted for driver quotes. Submit a quote; status workflow starts after the job is awarded.", color = TextSecondary, lineHeight = 20.sp)
            Spacer(Modifier.height(12.dp))
            QuoteBox(onSubmitQuote)
        } else {
            Text("Server confirmed: ${job.statusLabel()}", color = TextSecondary, fontSize = 13.sp)
            Text(
                buildString {
                    append("Local sync: ")
                    append(localSyncState?.state?.syncLabel() ?: "Synced")
                    if (localSyncState != null) append(" -> ${localSyncState.targetStatus.statusLabel()}")
                },
                color = if (localSyncState?.state == null) TextSecondary else localSyncState.state.syncColor(),
                fontSize = 13.sp,
            )
            if (!localSyncState?.lastError.isNullOrBlank()) {
                Text("Latest local sync error: ${localSyncState?.lastError}", color = Yellow, fontSize = 12.sp)
            }
            Spacer(Modifier.height(8.dp))
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
    hasPendingEvidence: Boolean = false,
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
                enabled = recipientName.isNotBlank() && (job.hasPod() || hasPendingEvidence),
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
private fun QuoteBox(onSubmitQuote: (String, String) -> Unit) {
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
        enabled = amount.toDoubleOrNull()?.let { it > 0.0 } == true,
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
    onMarkAllRead: () -> Unit,
    onLoadMore: () -> Unit,
    onOpenJob: (String) -> Unit,
    onNoteChange: (String) -> Unit,
) {
    var filter by remember { mutableStateOf("All") }
    val note = state.dispatchNoteDraft
    val assignedJobIds = remember(state.jobs) { state.jobs.mapTo(HashSet()) { it.id } }
    val visibleMessages = state.dispatcherMessages.filter { msg ->
        when (filter) {
            "Unread" -> !msg.read
            "With Job" -> !msg.jobId.isNullOrBlank()
            else -> true
        }
    }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    SegmentedTabs(listOf("All", "Unread", "With Job"), filter) { filter = it }
                }
                if (state.dispatcherUnreadCount > 0) {
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = onMarkAllRead,
                        colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                        shape = RoundedCornerShape(14.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    ) { Text("Mark All Read", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
            }
        }
        if (!state.dispatcherMessagesError.isNullOrBlank()) {
            item {
                XDriveCard {
                    Text(state.dispatcherMessagesError, color = Danger, fontSize = 13.sp)
                }
            }
        }
        if (visibleMessages.isEmpty()) {
            item {
                EmptyState(
                    "No messages",
                    "Dispatcher updates and job notifications will appear here.",
                )
            }
        } else {
            items(visibleMessages, key = { it.id }) { msg ->
                DispatcherMessageCard(
                    message = msg,
                    onMarkRead = onMarkRead,
                    onOpenJob = if (!msg.jobId.isNullOrBlank() && msg.jobId in assignedJobIds) onOpenJob else null,
                )
            }
        }
        if (state.dispatcherMessagesHasMore) {
            item {
                Button(
                    onClick = onLoadMore,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                    shape = RoundedCornerShape(14.dp),
                ) { Text("Load More", fontWeight = FontWeight.Bold) }
            }
        }
        item {
            XDriveCard {
                Text("Dispatch Note", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                XDriveTextField(note, onNoteChange, "Message", "Msg")
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { onSendNote(note, true) },
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
private fun DispatcherMessageCard(
    message: DispatcherMessage,
    onMarkRead: (String) -> Unit,
    onOpenJob: ((String) -> Unit)? = null,
) {
    XDriveCard {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                val title = message.text?.takeIf { it.isNotBlank() }
                    ?: message.eventType.split('_').joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                Text(title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                if (!message.jobRef.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text("Job: ${message.jobRef}", color = Yellow, fontSize = 13.sp)
                }
            }
            BadgeText(if (message.read) "Read" else "Unread", if (message.read) Success else Yellow)
        }
        Spacer(Modifier.height(8.dp))
        Text(
            listOf(message.eventType, message.createdAt.marketplaceTime()).filter { it.isNotBlank() }.joinToString(" | "),
            color = TextSecondary,
            fontSize = 12.sp,
        )
        if (!message.read || (onOpenJob != null && !message.jobId.isNullOrBlank())) {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                if (!message.read) {
                    Button(
                        onClick = { onMarkRead(message.id) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Blue, contentColor = TextPrimary),
                        shape = RoundedCornerShape(14.dp),
                    ) { Text("Mark Read", fontWeight = FontWeight.Bold) }
                }
                if (onOpenJob != null && !message.jobId.isNullOrBlank()) {
                    Button(
                        onClick = { onOpenJob(message.jobId!!) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Yellow, contentColor = Navy),
                        shape = RoundedCornerShape(14.dp),
                    ) { Text("Open Job", fontWeight = FontWeight.Bold) }
                }
            }
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
    onSetAvailabilityStatus: (DriverAvailabilityStatus) -> Unit,
    onToggleAvailabilitySlot: (Int, String, Boolean) -> Unit,
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
                        Text(state.profile?.displayName?.ifBlank { "Driver" } ?: "Driver", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                        Text(state.profile?.email?.ifBlank { state.session?.email ?: "-" } ?: "-", color = TextSecondary)
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
            AvailabilityCard(
                availability = state.availability,
                availabilityError = state.availabilityError,
                onSetStatus = onSetAvailabilityStatus,
                onToggleSlot = onToggleAvailabilitySlot,
            )
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
                val pending = state.invoices.count { it.paymentStatus?.contains("pending", true) == true || it.status.contains("pending", ignoreCase = true) || it.status.contains("submitted", ignoreCase = true) }
                val paid = state.invoices.count { it.paymentStatus?.contains("paid", true) == true || it.status.contains("paid", ignoreCase = true) }
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
                            listOf(
                                invoice.paymentStatus?.replaceFirstChar { it.uppercase() } ?: invoice.status,
                                invoice.amount?.let { "${invoice.currency} ${"%.2f".format(Locale.UK, it)}" }.orEmpty()
                            ).filter { it.isNotBlank() }.joinToString(" | ")
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
private fun AvailabilityCard(
    availability: DriverAvailability?,
    availabilityError: String?,
    onSetStatus: (DriverAvailabilityStatus) -> Unit,
    onToggleSlot: (Int, String, Boolean) -> Unit,
) {
    val statusOptions = DriverAvailabilityStatus.entries
    // Null availability means the server has not yet returned a confirmed status; do not
    // highlight any option as active (OFFLINE must not appear active by default).
    val currentStatus = availability?.status
    val days = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    val slots = listOf("AM", "PM", "EVENING")

    XDriveCard {
        Text("Availability", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
        Spacer(Modifier.height(4.dp))
        Text("Set your working status and weekly schedule.", color = TextSecondary, fontSize = 13.sp)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            statusOptions.forEach { option ->
                val isActive = option == currentStatus
                val bgColor = when {
                    option == DriverAvailabilityStatus.AVAILABLE && isActive -> Success
                    option == DriverAvailabilityStatus.BUSY && isActive -> Yellow
                    option == DriverAvailabilityStatus.OFFLINE && isActive -> Danger
                    else -> Panel
                }
                Button(
                    onClick = { onSetStatus(option) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = bgColor,
                        contentColor = if (isActive) Navy else TextSecondary,
                    ),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp),
                ) {
                    Text(option.label, fontWeight = if (isActive) FontWeight.Black else FontWeight.Normal, fontSize = 12.sp)
                }
            }
        }
        if (availability == null) {
            Spacer(Modifier.height(8.dp))
            if (availabilityError != null) {
                Text(availabilityError, color = Danger, fontSize = 13.sp)
            } else {
                Text("Loading availability…", color = TextSecondary, fontSize = 13.sp)
            }
        } else {
            Spacer(Modifier.height(14.dp))
            if (availabilityError != null) {
                Text("⚠ $availabilityError", color = Yellow, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
            }
            Text("Weekly Schedule", color = TextSecondary, fontWeight = FontWeight.Bold, fontSize = 13.sp, letterSpacing = 1.sp)
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(Modifier.width(42.dp))
                slots.forEach { slotName ->
                    Text(
                        slotName,
                        color = TextSecondary,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            days.forEachIndexed { dayIndex, dayName ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(dayName, color = TextPrimary, fontSize = 13.sp, modifier = Modifier.width(42.dp))
                    slots.forEach { slotName ->
                        val isOn = availability.slots.any { it.dayOfWeek == dayIndex && it.slot == slotName && it.available }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .padding(2.dp)
                                .height(28.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isOn) Success else Panel)
                                .clickable { onToggleSlot(dayIndex, slotName, !isOn) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                if (isOn) "✓" else "–",
                                color = if (isOn) Navy else TextSecondary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
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
private fun BottomNav(selected: DriverTab, activeCount: Int, unreadMessageCount: Int, onTabChange: (DriverTab) -> Unit) {
    val tabs = listOf(DriverTab.NEARBY, DriverTab.QUOTES, DriverTab.JOBS, DriverTab.MESSAGES, DriverTab.PROFILE)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Navy2)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        tabs.forEach { tab ->
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (tab == selected) Color(0xFF17243F) else Color.Transparent)
                    .clickable { onTabChange(tab) }
                    .padding(vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    tab.navLabel(activeCount, unreadMessageCount),
                    color = if (tab == selected) Yellow else TextSecondary,
                    fontSize = 13.sp,
                    fontWeight = if (tab == selected) FontWeight.Bold else FontWeight.Normal,
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
    DriverTab.NEARBY -> "Nearby Jobs"
    DriverTab.QUOTES -> "My Quotes"
    DriverTab.BOOKINGS -> "Bookings"
    DriverTab.JOBS -> "My Jobs"
    DriverTab.SMARTPAY -> "XDrive Pay"
    DriverTab.ACTION -> "Job Details"
    DriverTab.MESSAGES -> "Alerts"
    DriverTab.PROFILE -> "Profile"
}

private fun DriverUiState.headerTitle(): String {
    val selected = jobs.firstOrNull { it.id == selectedJobId }
    return if (selectedTab == DriverTab.ACTION && selected?.isPosted() == true) {
        "Load ID ${selected.id.take(8).uppercase()}"
    } else {
        selectedTab.screenTitle()
    }
}

private fun DriverTab.navLabel(activeCount: Int = 0, unreadMessageCount: Int = 0) = when (this) {
    DriverTab.NEARBY -> "Nearby"
    DriverTab.QUOTES -> "Quotes"
    DriverTab.BOOKINGS -> "Bookings"
    DriverTab.JOBS -> if (activeCount > 0) "Jobs $activeCount" else "Jobs"
    DriverTab.SMARTPAY -> "Pay"
    DriverTab.ACTION -> "Job"
    DriverTab.MESSAGES -> if (unreadMessageCount > 0) "Alerts $unreadMessageCount" else "Alerts"
    DriverTab.PROFILE -> "Profile"
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

private fun DriverJob.statusKey(): String = currentStatus.ifBlank { status }.lowercase()

private fun DriverJob.driverStatusKey(): String =
    when (statusKey()) {
        "collected" -> "loaded"
        "in_transit" -> "on_site_delivery"
        else -> statusKey()
    }

private fun DriverJob.isInProgress(): Boolean =
    driverStatusKey() in listOf("on_my_way", "on_site_pickup", "loaded", "on_site_delivery", "in_progress")

private fun DriverJob.isActive(): Boolean = driverStatusKey() !in listOf("delivered", "completed", "cancelled", "canceled")

private fun DriverJob.isPosted(): Boolean = driverStatusKey() == "posted"

private fun DriverJob.routeLabel(): String = "${pickupLocation.ifBlank { "Pickup" }} -> ${deliveryLocation.ifBlank { "Delivery" }}"

private fun DriverJob.statusLabel(): String = driverStatusKey().statusLabel()

private fun String.statusLabel(): String =
    when (this) {
        "pod" -> "POD"
        "allocated" -> "Accepted"
        "on_my_way" -> "On My Way to Collection"
        "on_site_pickup" -> "Arrived at Collection"
        "loaded" -> "Loaded"
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

private fun DriverJob.nextStatus(): String = when (driverStatusKey()) {
    "allocated" -> "on_my_way"
    "on_my_way" -> "on_site_pickup"
    "on_site_pickup" -> "loaded"
    "loaded" -> "on_site_delivery"
    "on_site_delivery" -> "delivered"
    "delivered" -> "completed"
    else -> ""
}

private fun DriverJob.nextActionLabel(): String = when (nextStatus()) {
    "on_my_way" -> "On My Way"
    "on_site_pickup" -> "Arrived at Collection"
    "loaded" -> "Loaded / Collected"
    "on_site_delivery" -> "Arrived at Delivery"
    "delivered" -> "Mark as Delivered"
    "completed" -> "Complete Job"
    else -> "No further action"
}

private fun DriverJob.canMoveNext(): Boolean =
    nextStatus().isNotBlank() && (nextStatus() != "delivered" || hasPod())

private fun MobileQueueState.syncLabel(): String = when (this) {
    MobileQueueState.PENDING -> "Pending"
    MobileQueueState.SYNCING -> "Syncing"
    MobileQueueState.BLOCKED -> "Blocked"
    MobileQueueState.PERMANENT_FAILURE -> "Permanent Failure"
    MobileQueueState.SYNCED -> "Synced"
}

private fun MobileQueueState.syncColor(): Color = when (this) {
    MobileQueueState.PENDING -> Yellow
    MobileQueueState.SYNCING -> Blue
    MobileQueueState.BLOCKED,
    MobileQueueState.PERMANENT_FAILURE -> Danger
    MobileQueueState.SYNCED -> Success
}

private fun MainActivity.hasForegroundLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    return fine || coarse
}

private fun MainActivity.trackingRuntimePermissions(): Array<String> =
    arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

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
