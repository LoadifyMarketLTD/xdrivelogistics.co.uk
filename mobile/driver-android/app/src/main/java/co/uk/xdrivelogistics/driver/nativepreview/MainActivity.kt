package co.uk.xdrivelogistics.driver.nativepreview

import android.os.Bundle
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Density
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.uk.xdrivelogistics.driver.nativepreview.data.AuthStore
import co.uk.xdrivelogistics.driver.nativepreview.data.LoadsRepository
import co.uk.xdrivelogistics.driver.nativepreview.data.DriverRepository
import co.uk.xdrivelogistics.driver.nativepreview.data.XDriveApi
import co.uk.xdrivelogistics.driver.nativepreview.model.NativeLoad
import co.uk.xdrivelogistics.driver.nativepreview.ui.AuthUiState
import co.uk.xdrivelogistics.driver.nativepreview.ui.AuthViewModel
import co.uk.xdrivelogistics.driver.nativepreview.ui.LoadsUiState
import co.uk.xdrivelogistics.driver.nativepreview.ui.LoadsViewModel
import co.uk.xdrivelogistics.driver.nativepreview.ui.DriverModulesViewModel
import co.uk.xdrivelogistics.driver.nativepreview.ui.DriverModulesState
import java.util.Locale
import java.time.OffsetDateTime
import java.time.ZoneId
import kotlinx.coroutines.launch
import org.json.JSONObject

private val XDriveNavy = Color(0xFF0B2F6B)
private val XDriveBlue = Color(0xFF1D57D8)
private val XDriveOrange = Color(0xFFF5A300)
private val AppBackground = Color(0xFFF4F6F8)
private val CardWhite = Color(0xFFFFFFFF)
private val MutedText = Color(0xFF64748B)
private val StrongText = Color(0xFF111827)
private val XDriveColorScheme = lightColorScheme(
    primary = XDriveNavy,
    onPrimary = Color.White,
    secondary = XDriveBlue,
    onSecondary = Color.White,
    tertiary = XDriveOrange,
    onTertiary = Color(0xFF172033),
    background = AppBackground,
    onBackground = StrongText,
    surface = CardWhite,
    onSurface = StrongText,
    outline = Color(0xFFDCE3EA)
)

private data class NativeTab(
    val label: String,
    val icon: ImageVector
)

private val tabs = listOf(
    NativeTab("Loads", Icons.Filled.Home),
    NativeTab("Alerts", Icons.Filled.Notifications),
    NativeTab("My Quotes", Icons.Filled.ReceiptLong),
    NativeTab("Bookings", Icons.Filled.CalendarMonth),
    NativeTab("More", Icons.Filled.MoreHoriz),
)

class MainActivity : ComponentActivity() {
    private lateinit var authViewModel: AuthViewModel
    private lateinit var loadsViewModel: LoadsViewModel
    private lateinit var modulesViewModel: DriverModulesViewModel
    private lateinit var api: XDriveApi

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val authStore = AuthStore(applicationContext)
        api = XDriveApi(authStore)
        val repository = LoadsRepository(authStore, api)

        authViewModel = ViewModelProvider(
            this,
            SimpleFactory { AuthViewModel(authStore, api) }
        )[AuthViewModel::class.java]

        loadsViewModel = ViewModelProvider(
            this,
            SimpleFactory { LoadsViewModel(repository, authStore) }
        )[LoadsViewModel::class.java]

        modulesViewModel = ViewModelProvider(
            this,
            SimpleFactory { DriverModulesViewModel(DriverRepository(api)) }
        )[DriverModulesViewModel::class.java]

        setContent {
            val systemDensity = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(systemDensity.density, fontScale = 1.0f)) {
                MaterialTheme(colorScheme = XDriveColorScheme) {
                val authState by authViewModel.state.collectAsStateWithLifecycle()
                val loadsState by loadsViewModel.state.collectAsStateWithLifecycle()
                val modulesState by modulesViewModel.state.collectAsStateWithLifecycle()

                LaunchedEffect(authState.signedIn) {
                    if (authState.signedIn) {
                        loadsViewModel.load()
                        modulesViewModel.load()
                    } else if (BuildConfig.DEBUG) {
                        loadsViewModel.loadCachedOnly()
                        modulesViewModel.clear()
                    } else {
                        loadsViewModel.clearForSignOut()
                        modulesViewModel.clear()
                    }
                }

                if (authState.signedIn) {
                    XDriveNativeApp(
                        loadsState = loadsState,
                        modulesState = modulesState,
                        onRefreshLoads = loadsViewModel::refresh,
                        onRefreshModules = modulesViewModel::load,
                        onSubmitQuote = loadsViewModel::submitQuote,
                        onClearQuoteResult = loadsViewModel::clearQuoteResult,
                        onToggleSaved = loadsViewModel::toggleSaved,
                        onToggleDismissed = loadsViewModel::toggleDismissed,
                        onSignOut = authViewModel::signOut,
                        api = api
                    )
                } else {
                    LoginScreen(
                        state = authState,
                        onSignIn = authViewModel::signIn
                    )
                }
            }
            }
        }
    }
}

private class SimpleFactory<T : ViewModel>(
    private val create: () -> T
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <VM : ViewModel> create(modelClass: Class<VM>): VM = create() as VM
}

@Composable
private fun LoginScreen(
    state: AuthUiState,
    onSignIn: (String, String) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AppBackground)
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardWhite)
        ) {
            Column(modifier = Modifier.padding(22.dp)) {
                Text(
                    text = "XDRIVE LOGISTICS",
                    color = XDriveNavy,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.8.sp
                )
                Spacer(modifier = Modifier.height(5.dp))
                Text(
                    text = "Native Driver Preview",
                    color = StrongText,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "This preview signs in through Supabase and uses the read-only Driver Workspace API for Loads. It does not replace the official mobile device session.",
                    color = MutedText,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(20.dp))

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    enabled = !state.loading
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    enabled = !state.loading
                )

                if (!state.error.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = state.error,
                        color = Color(0xFFB42318),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))
                Button(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    onClick = { onSignIn(email, password) },
                    enabled = !state.loading,
                    colors = ButtonDefaults.buttonColors(containerColor = XDriveOrange, contentColor = Color(0xFF172033))
                ) {
                    if (state.loading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.height(22.dp)
                        )
                    } else {
                        Text(
                            text = "Sign in",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun XDriveNativeApp(
    loadsState: LoadsUiState,
    modulesState: DriverModulesState,
    onRefreshLoads: () -> Unit,
    onRefreshModules: () -> Unit,
    onSubmitQuote: (String, Double, Int?, String) -> Unit,
    onClearQuoteResult: () -> Unit,
    onToggleSaved: (String) -> Unit,
    onToggleDismissed: (String) -> Unit,
    onSignOut: () -> Unit,
    api: XDriveApi
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var selectedLoadTab by remember { mutableStateOf("available") }
    var selectedLoad by remember { mutableStateOf<NativeLoad?>(null) }
    var showRoute by remember { mutableStateOf(false) }
    var morePage by remember { mutableStateOf<String?>(null) }

    BackHandler(enabled = selectedLoad != null || morePage != null) {
        if (morePage != null) morePage = null else if (showRoute) showRoute = false else selectedLoad = null
    }

    Scaffold(
        containerColor = AppBackground,
        bottomBar = {
            NavigationBar(
                modifier = Modifier
                    .navigationBarsPadding()
                    .height(72.dp),
                containerColor = XDriveNavy,
                tonalElevation = 0.dp
            ) {
                tabs.forEachIndexed { index, tab ->
                    val selected = selectedTab == index
                    NavigationBarItem(
                        selected = selected,
                        onClick = { selectedTab = index },
                        icon = {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label,
                                modifier = Modifier.height(21.dp)
                            )
                        },
                        label = {
                            Text(
                                text = tab.label,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.White,
                            selectedTextColor = XDriveOrange,
                            indicatorColor = Color.Transparent,
                            unselectedIconColor = Color.White,
                            unselectedTextColor = Color.White
                        )
                    )
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(AppBackground)
        ) {
            if (selectedTab == 4) {
                LegacyMoreModule(page = morePage ?: "more.html", api = api)
            } else if (selectedTab == 0 && selectedLoad != null && showRoute) {
                NativeRouteScreen(load = selectedLoad!!, onBack = { showRoute = false })
            } else if (selectedTab == 0 && selectedLoad != null) {
                NativeLoadDetailScreen(
                    load = selectedLoad!!,
                    quoteSubmitting = loadsState.quoteSubmitting,
                    quoteSuccess = loadsState.quoteSuccess,
                    quoteError = loadsState.quoteError,
                    onSubmitQuote = onSubmitQuote,
                    onClearQuoteResult = onClearQuoteResult,
                    isSaved = selectedLoad!!.id in loadsState.savedLoadIds,
                    isDismissed = selectedLoad!!.id in loadsState.dismissedLoadIds,
                    onToggleSaved = { onToggleSaved(selectedLoad!!.id) },
                    onToggleDismissed = { onToggleDismissed(selectedLoad!!.id) },
                    onOpenRoute = { showRoute = true },
                    onBack = { selectedLoad = null }
                )
            } else {
                NativeHeader(
                    title = tabs[selectedTab].label,
                    showLoadTabs = selectedTab == 0,
                    selectedLoadTab = selectedLoadTab,
                    onLoadTab = { selectedLoadTab = it }
                )
                when (selectedTab) {
                    0 -> NativeLoadsScreen(
                        state = loadsState,
                        selectedLoadTab = selectedLoadTab,
                        onRefresh = onRefreshLoads,
                        onOpenLoad = { selectedLoad = it }
                    )
                    1 -> AlertsNativeScreen(modulesState, onRefreshModules)
                    2 -> QuotesNativeScreen(modulesState, onRefreshModules)
                    3 -> BookingsNativeScreen(modulesState, onRefreshModules)
                    4 -> MoreScreen(onSignOut = onSignOut, onOpen = { morePage = it })
                }
            }
        }
    }
}

@Composable
private fun NativeHeader(
    title: String,
    showLoadTabs: Boolean,
    selectedLoadTab: String,
    onLoadTab: (String) -> Unit
) {
    Surface(color = XDriveNavy, shadowElevation = 1.dp) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp)
                .padding(top = 18.dp, bottom = if (showLoadTabs) 10.dp else 15.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    Text("X", color = XDriveOrange, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("Drive", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                }
                Text(
                    text = title,
                    modifier = Modifier.weight(1f),
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(modifier = Modifier.weight(1f))
            }
            if (showLoadTabs) {
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HeaderLoadTab("Available", "available", selectedLoadTab, onLoadTab, Modifier.weight(1f))
                    HeaderLoadTab("Saved", "saved", selectedLoadTab, onLoadTab, Modifier.weight(1f))
                    HeaderLoadTab("Dismissed", "dismissed", selectedLoadTab, onLoadTab, Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun HeaderLoadTab(
    label: String,
    key: String,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier
) {
    Button(
        onClick = { onSelect(key) },
        modifier = modifier.height(42.dp),
        shape = RoundedCornerShape(20.dp),
        contentPadding = PaddingValues(horizontal = 4.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected == key) XDriveOrange else Color(0xFF284D86),
            contentColor = if (selected == key) Color(0xFF172033) else Color.White
        )
    ) {
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun NativeLoadsScreen(
    state: LoadsUiState,
    selectedLoadTab: String,
    onRefresh: () -> Unit,
    onOpenLoad: (NativeLoad) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        val visibleLoads = when (selectedLoadTab) {
            "saved" -> state.loads.filter { it.id in state.savedLoadIds }
            "dismissed" -> state.loads.filter { it.id in state.dismissedLoadIds }
            else -> state.loads.filter { it.id !in state.dismissedLoadIds }
        }

        when {
            state.loading && state.loads.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = XDriveBlue)
                }
            }

            !state.error.isNullOrBlank() && state.loads.isEmpty() -> {
                EmptyPanel(
                    title = "Loads could not be loaded",
                    body = state.error
                )
            }

            visibleLoads.isEmpty() -> {
                EmptyPanel(
                    title = when (selectedLoadTab) {
                        "saved" -> "No saved loads yet"
                        "dismissed" -> "No dismissed loads"
                        else -> "No available loads right now"
                    },
                    body = when (selectedLoadTab) {
                        "saved" -> "Loads saved for later will appear here."
                        "dismissed" -> "Dismissed loads will remain here until restored."
                        else -> "New marketplace loads will appear here."
                    }
                )
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 12.dp)
                ) {
                    items(visibleLoads, key = { it.id }) { load ->
                        NativeLoadCard(
                            load = load,
                            modifier = Modifier.padding(horizontal = 12.dp),
                            onOpen = { onOpenLoad(load) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeLoadCard(
    load: NativeLoad,
    modifier: Modifier = Modifier,
    onOpen: () -> Unit
) {
    val context = LocalContext.current
    var livePickupMiles by remember(load.id) { mutableStateOf<Double?>(null) }
    var livePickupMinutes by remember(load.id) { mutableStateOf<Double?>(null) }

    LaunchedEffect(load.id) {
        val (miles, minutes) = calculatePickupMetric(context, load)
        livePickupMiles = miles
        livePickupMinutes = minutes
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0xFFDCE3EA)),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = if (load.memberId.isNullOrBlank()) load.companyName else "${load.companyName} (${load.memberId})",
                color = StrongText,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = "Load ID ${load.reference}" + (load.vehicleLabel?.let { " | $it" } ?: ""),
                color = MutedText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LoadBadge("NEW", Color(0xFFEAF7EE), Color(0xFF16813B))
                load.serviceMode?.let {
                    LoadBadge(it.replace('_', ' ').uppercase(Locale.UK), Color(0xFFFFF1D8), Color(0xFFB86A00))
                }
            }

            Spacer(modifier = Modifier.height(9.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFFCFDFE),
                shape = RoundedCornerShape(11.dp),
                border = BorderStroke(1.dp, Color(0xFFDCE3EA))
            ) {
                Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp)) {
                    NativeRouteStop("1", displayArea(load.pickupArea), "Collect ${formatLoadDateTime(load.pickupAt)}")
                    Spacer(modifier = Modifier.height(10.dp))
                    NativeRouteStop("2", displayArea(load.deliveryArea), "Deliver ${formatLoadDateTime(load.deliveryAt)}")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Color(0xFFEEF2F6))
            Spacer(modifier = Modifier.height(7.dp))
            MetricRow(
                "To Collection",
                routeMetric(
                    livePickupMiles ?: load.distanceToPickupMiles,
                    livePickupMinutes ?: load.pickupEtaMinutes
                ),
                StrongText
            )
            Spacer(modifier = Modifier.height(6.dp))
            HorizontalDivider(color = Color(0xFFEEF2F6))
            Spacer(modifier = Modifier.height(7.dp))
            MetricRow("Job Distance", routeMetric(load.jobDistanceMiles, load.jobDistanceMinutes), StrongText)

            val cargo = cargoSummary(load)
            if (cargo.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(cargo, color = Color(0xFF374151), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(10.dp))
            Button(
                onClick = onOpen,
                modifier = Modifier.fillMaxWidth().height(42.dp),
                shape = RoundedCornerShape(21.dp),
                colors = ButtonDefaults.buttonColors(containerColor = XDriveOrange, contentColor = Color(0xFF172033))
            ) {
                Text("Quote", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun NativeRouteScreen(load: NativeLoad, onBack: () -> Unit) {
    Scaffold(
        containerColor = Color(0xFFE7EEF3),
        topBar = {
            Surface(
                color = XDriveOrange,
                shadowElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(64.dp)
                        .padding(horizontal = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back", tint = StrongText)
                    }
                    Text(
                        "Route",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = StrongText
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            RouteMapContent(load = load)
        }
    }
}

@Composable
private fun NativeLoadDetailScreen(
    load: NativeLoad,
    quoteSubmitting: Boolean,
    quoteSuccess: String?,
    quoteError: String?,
    onSubmitQuote: (String, Double, Int?, String) -> Unit,
    onClearQuoteResult: () -> Unit,
    isSaved: Boolean,
    isDismissed: Boolean,
    onToggleSaved: () -> Unit,
    onToggleDismissed: () -> Unit,
    onOpenRoute: () -> Unit,
    onBack: () -> Unit
) {
    var quoteOpen by remember(load.id) { mutableStateOf(false) }
    var quoteAmount by remember(load.id) { mutableStateOf("") }
    var collectMinutes by remember(load.id) { mutableStateOf("") }
    var quoteMessage by remember(load.id) { mutableStateOf("") }
    val context = LocalContext.current
    var livePickupMiles by remember(load.id) { mutableStateOf<Double?>(null) }
    var livePickupMinutes by remember(load.id) { mutableStateOf<Double?>(null) }

    LaunchedEffect(load.id) {
        val (miles, minutes) = calculatePickupMetric(context, load)
        livePickupMiles = miles
        livePickupMinutes = minutes
    }

    Column(modifier = Modifier.fillMaxSize().background(AppBackground)) {
        Surface(color = XDriveNavy, shadowElevation = 1.dp) {
            Row(
                modifier = Modifier.fillMaxWidth().height(66.dp).padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                Text(
                    text = "Load Details",
                    modifier = Modifier.weight(1f),
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(modifier = Modifier.width(48.dp))
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(12.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Color(0xFFDCE3EA)),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(
                        if (load.memberId.isNullOrBlank()) load.companyName else "${load.companyName} (${load.memberId})",
                        color = StrongText,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "Load ID ${load.reference}" + (load.vehicleLabel?.let { " | $it" } ?: ""),
                        color = MutedText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        LoadBadge("OPEN", Color(0xFFFFF1D8), Color(0xFFB86A00))
                    }
                    Spacer(Modifier.height(9.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFFFCFDFE),
                        shape = RoundedCornerShape(11.dp),
                        border = BorderStroke(1.dp, Color(0xFFDCE3EA))
                    ) {
                        Column(Modifier.padding(10.dp)) {
                            NativeRouteStop("1", displayArea(load.pickupArea), "Collect ${formatLoadDateTime(load.pickupAt)}")
                            Spacer(Modifier.height(10.dp))
                            NativeRouteStop("2", displayArea(load.deliveryArea), "Deliver ${formatLoadDateTime(load.deliveryAt)}")
                        }
                    }
                    Spacer(Modifier.height(9.dp))
                    Button(
                        onClick = onOpenRoute,
                        modifier = Modifier.fillMaxWidth().height(40.dp),
                        shape = RoundedCornerShape(20.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = XDriveBlue, contentColor = Color.White)
                    ) { Text("View Route Map", fontWeight = FontWeight.ExtraBold) }
                }
            }

            Spacer(Modifier.height(10.dp))
            DetailPanel("Job information") {
                DetailInfoRow("Vehicle", load.vehicleLabel ?: "Not supplied")
                DetailInfoRow(
                    "To Collection",
                    routeMetric(
                        livePickupMiles ?: load.distanceToPickupMiles,
                        livePickupMinutes ?: load.pickupEtaMinutes
                    )
                )
                DetailInfoRow("Job Distance", routeMetric(load.jobDistanceMiles, load.jobDistanceMinutes))
                DetailInfoRow("Cargo", cargoSummary(load).ifBlank { "Not supplied" })
                if (load.handlingRequirements.isNotEmpty()) {
                    DetailInfoRow("Requirements", load.handlingRequirements.joinToString(" · "))
                }
            }

            Spacer(Modifier.height(10.dp))
            DetailPanel("Customer") {
                DetailInfoRow(
                    "Cust",
                    if (load.memberId.isNullOrBlank()) load.companyName else load.companyName + " (" + load.memberId + ")"
                )
                load.paymentTerms?.takeIf { it.isNotBlank() && !it.equals("null", true) }?.let { DetailInfoRow("Terms", it) }
                load.memberPhone?.takeIf { it.isNotBlank() && !it.equals("null", true) }?.let { DetailInfoRow("Tel", it) }
            }

            load.publicQuoteNotes?.takeIf { it.isNotBlank() && !it.equals("null", true) }?.let { notes ->
                Spacer(Modifier.height(10.dp))
                DetailPanel("Notes") {
                    Text(notes, color = StrongText, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onToggleSaved,
                    modifier = Modifier.weight(1f).height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isSaved) XDriveNavy else Color(0xFFEAF2FF),
                        contentColor = if (isSaved) Color.White else XDriveBlue
                    )
                ) { Text(if (isSaved) "SAVED" else "SAVE", fontWeight = FontWeight.ExtraBold) }
                Button(
                    onClick = onToggleDismissed,
                    modifier = Modifier.weight(1f).height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = XDriveOrange,
                        contentColor = StrongText
                    )
                ) { Text(if (isDismissed) "RESTORE" else "DISMISS", fontWeight = FontWeight.ExtraBold) }
            }

            Spacer(Modifier.height(12.dp))
            if (quoteOpen) {
                DetailPanel("Quote") {
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = quoteAmount,
                        onValueChange = { quoteAmount = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        label = { Text("Price (£)") },
                        singleLine = true,
                        enabled = !quoteSubmitting
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = collectMinutes,
                        onValueChange = { collectMinutes = it.filter(Char::isDigit) },
                        label = { Text("Collect within (minutes)") },
                        singleLine = true,
                        enabled = !quoteSubmitting
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = quoteMessage,
                        onValueChange = { quoteMessage = it },
                        label = { Text("Notes (optional)") },
                        enabled = !quoteSubmitting
                    )
                    if (!quoteError.isNullOrBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(quoteError, color = Color(0xFFB42318), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (!quoteSuccess.isNullOrBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text("Quote submitted", color = Color(0xFF16813B), fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = {
                            val amount = quoteAmount.toDoubleOrNull()
                            if (amount != null && amount > 0) {
                                onClearQuoteResult()
                                onSubmitQuote(
                                    load.id,
                                    amount,
                                    collectMinutes.toIntOrNull(),
                                    quoteMessage.trim()
                                )
                            }
                        },
                        enabled = !quoteSubmitting && (quoteAmount.toDoubleOrNull() ?: 0.0) > 0,
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        shape = RoundedCornerShape(23.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A), contentColor = Color.White)
                    ) {
                        if (quoteSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp, color = Color(0xFF172033))
                        } else {
                            Text("Submit Quote", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            } else {
                Button(
                    onClick = {
                        onClearQuoteResult()
                        quoteOpen = true
                    },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(23.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A), contentColor = Color.White)
                ) { Text("£  Quote", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold) }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun NativeProfileScreen(api: XDriveApi, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var memberId by remember { mutableStateOf("") }
    var companyName by remember { mutableStateOf("") }
    var companyId by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var availability by remember { mutableStateOf("") }
    var driverType by remember { mutableStateOf("") }

    fun loadProfile() {
        scope.launch {
            loading = true
            error = null
            val response = api.getProfile()
            if (!response.successful) {
                error = "Unable to load Driver profile (" + response.status + ")"
                loading = false
                return@launch
            }
            runCatching {
                val root = JSONObject(response.body)
                val resources = root.optJSONObject("resources") ?: root
                val profile = resources.optJSONObject("profile") ?: JSONObject()
                val driver = resources.optJSONObject("driver") ?: JSONObject()
                val company = resources.optJSONObject("company") ?: JSONObject()
                displayName = profile.optString("display_name", profile.optString("displayName"))
                email = profile.optString("email")
                phone = profile.optString("phone")
                memberId = profile.optString("driver_id", profile.optString("id"))
                companyName = company.optString("name", profile.optString("company_name"))
                companyId = company.optString("xd_id", profile.optString("company_xd_id"))
                status = driver.optString("status")
                availability = driver.optString("availability_status")
                driverType = driver.optString("driver_type")
            }.onFailure { error = "Driver profile response could not be read." }
            loading = false
        }
    }

    LaunchedEffect(Unit) { loadProfile() }

    Column(Modifier.fillMaxSize().background(AppBackground).verticalScroll(rememberScrollState())) {
        Surface(color = XDriveOrange, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Back", tint = StrongText) }
                Text("My Profile", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = StrongText)
            }
        }
        Column(Modifier.padding(16.dp)) {
            if (loading) {
                Box(Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                DetailPanel("Driver account") {
                    OutlinedTextField(displayName, { displayName = it.take(160); saved = false }, label = { Text("Display name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(phone, { phone = it.take(40); saved = false }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    Spacer(Modifier.height(10.dp))
                    DetailInfoRow("Email", email.ifBlank { "—" })
                    DetailInfoRow("Driver ID", memberId.ifBlank { "—" })
                    DetailInfoRow("Company", companyName.ifBlank { "—" })
                    DetailInfoRow("Company ID", companyId.ifBlank { "—" })
                    DetailInfoRow("Status", status.ifBlank { "—" })
                    DetailInfoRow("Availability", availability.ifBlank { "—" })
                    DetailInfoRow("Driver type", driverType.ifBlank { "—" })
                }
                if (!error.isNullOrBlank()) { Spacer(Modifier.height(10.dp)); Text(error!!, color = Color(0xFFB42318), fontWeight = FontWeight.SemiBold) }
                if (saved) { Spacer(Modifier.height(10.dp)); Text("Profile saved to XDrive.", color = Color(0xFF16813B), fontWeight = FontWeight.Bold) }
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = {
                        scope.launch {
                            saving = true; error = null; saved = false
                            val response = api.putProfile(displayName.trim(), phone.trim())
                            if (response.successful) { saved = true; loadProfile() }
                            else error = "Unable to save Driver profile (" + response.status + ")"
                            saving = false
                        }
                    },
                    enabled = !saving && displayName.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = XDriveNavy, contentColor = Color.White)
                ) {
                    if (saving) CircularProgressIndicator(modifier = Modifier.height(22.dp), strokeWidth = 2.dp, color = Color.White)
                    else Text("Save Profile", fontWeight = FontWeight.ExtraBold)
                }
            }
        }
    }
}

@Composable
private fun DetailPanel(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0xFFDCE3EA)),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(title, color = XDriveNavy, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun DetailInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Text(label, color = MutedText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Text(value, modifier = Modifier.weight(1f).padding(start = 14.dp), color = StrongText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LoadBadge(label: String, background: Color, foreground: Color) {
    Surface(color = background, shape = RoundedCornerShape(7.dp)) {
        Text(label, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp), color = foreground, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun NativeRouteStop(number: String, place: String, timing: String) {
    Row(verticalAlignment = Alignment.Top) {
        Surface(modifier = Modifier.width(24.dp).height(24.dp), color = Color(0xFF2563D9), shape = RoundedCornerShape(6.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text(number, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
        Spacer(modifier = Modifier.width(9.dp))
        Column {
            Text(place, color = StrongText, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(modifier = Modifier.height(1.dp))
            Text(timing, color = Color(0xFF4B5563), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun RoutePoint(label: String, value: String) {
    Column {
        Text(
            text = label,
            color = MutedText,
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.6.sp
        )
        Text(
            text = value,
            color = StrongText,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun MetricRow(
    label: String,
    value: String,
    accent: Color
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            color = StrongText,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = value,
            color = accent,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold
        )
    }
}

@Composable
private fun NativeStateChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = if (selected) XDriveNavy else CardWhite,
        shape = MaterialTheme.shapes.medium
    ) {
        Box(
            modifier = Modifier.padding(vertical = 9.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                color = if (selected) Color.White else MutedText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun EmptyPanel(
    title: String,
    body: String
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = CardWhite)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Text(
                text = title,
                color = StrongText,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = body,
                color = MutedText,
                fontSize = 14.sp
            )
        }
    }
}

private data class MoreItem(val icon: String, val title: String, val subtitle: String, val page: String)

@Composable
private fun MoreScreen(
    onSignOut: () -> Unit,
    onOpen: (String) -> Unit
) {
    val items = remember { listOf(
        MoreItem("D", "Daniel Preda", "Driver account", "profile.html"),
        MoreItem("V", "Vehicle", "Vehicle details and availability", "vehicle.html"),
        MoreItem("DOC", "Documents", "Driver and vehicle records", "documents.html"),
        MoreItem("!", "Alerts", "Load and job alerts", "alerts.html"),
        MoreItem("LOG", "Event Log", "Read-only operational history", "event-log.html"),
        MoreItem("+", "Post Load", "Create and advertise a new load", "post-load.html"),
        MoreItem(">", "Return Journey", "Journey availability and matching", "return-journey.html"),
        MoreItem("ON", "Availability", "Share live availability for a limited time", "availability.html"),
        MoreItem("MAP", "Who's Nearby", "Fleet and privacy-rounded Exchange availability", "nearby.html"),
        MoreItem("DIR", "Directory", "Find XDrive members and fleet capability", "directory.html"),
        MoreItem("PIN", "Future Position", "Publish where you will be available next", "future-position.html"),
        MoreItem("!", "Smart Load Alerts", "Configure matching and notification rules", "smart-load-alerts.html"),
        MoreItem("MSG", "Messenger", "Job and dispatcher messages", "messenger.html"),
        MoreItem("GBP", "Invoices & Earnings", "Invoices, payment status and earnings", "invoices.html"),
        MoreItem("?", "Help & Support", "Technical help and support tickets", "support.html")
    ) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(AppBackground),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        item {
            Text("XDRIVE DRIVER", color = MutedText, fontSize = 12.sp, letterSpacing = 2.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
            Text("More", color = StrongText, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(horizontal = 10.dp))
            Text("Driver account, tools and records", color = MutedText, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
            Spacer(Modifier.height(8.dp))
        }
        items(items) { item ->
            Card(
                onClick = { onOpen(item.page) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0xFFDCE3EA)),
                colors = CardDefaults.cardColors(containerColor = CardWhite)
            ) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = RoundedCornerShape(28.dp), color = Color(0xFFEDF7F2), modifier = Modifier.size(48.dp)) {
                        Box(contentAlignment = Alignment.Center) { Text(item.icon, fontSize = if (item.icon.length > 1) 11.sp else 20.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF16813B)) }
                    }
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(item.title, color = StrongText, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                        Text(item.subtitle, color = MutedText, fontSize = 12.sp, fontWeight = FontWeight.Bold, lineHeight = 16.sp)
                    }
                    Text(">", color = StrongText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            OutlinedButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(25.dp), border = BorderStroke(2.dp, Color(0xFF16A34A))) {
                Text("Sign Out", color = Color(0xFF16813B), fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun FoundationPlaceholder(tab: String) {
    EmptyPanel(
        title = tab + " native module",
        body = "This module has not been switched to the native data layer yet. The current XDrive application remains available during migration."
    )
}

private fun displayArea(value: String): String {
    val area = value.trim().uppercase(Locale.UK)
    val prefix = area.takeWhile { it.isLetter() }
    val city = mapOf("BB" to "BLACKBURN", "DA" to "ERITH", "LS" to "LEEDS", "NG" to "NOTTINGHAM", "PR" to "PRESTON", "M" to "MANCHESTER", "CH" to "CHESTER", "CV" to "COVENTRY", "WN" to "WIGAN", "SK" to "STOCKPORT")[prefix]
    return if (city == null) area else "$city, $area"
}

private fun formatLoadDateTime(value: String?): String {
    if (value.isNullOrBlank()) return "TBC"
    return runCatching {
        val dt = OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault())
        val month = when (dt.monthValue) {
            1 -> "Jan"; 2 -> "Feb"; 3 -> "Mar"; 4 -> "Apr"; 5 -> "May"; 6 -> "Jun"
            7 -> "Jul"; 8 -> "Aug"; 9 -> "Sept"; 10 -> "Oct"; 11 -> "Nov"; else -> "Dec"
        }
        "%02d:%02d · %d %s".format(Locale.UK, dt.hour, dt.minute, dt.dayOfMonth, month)
    }.getOrDefault("TBC")
}

private fun routeMetric(miles: Double?, minutes: Double?): String {
    if (miles == null) return "Not available"
    val milesText = String.format(Locale.UK, "%.1f mi", miles)
    if (minutes == null || minutes <= 0.0) return milesText
    val totalMinutes = minutes.toInt()
    val hours = totalMinutes / 60
    val remainingMinutes = totalMinutes % 60
    val durationText = if (hours > 0) {
        if (remainingMinutes > 0) "${hours} h ${remainingMinutes} min" else "${hours} h"
    } else {
        "${remainingMinutes} min"
    }
    return milesText + " · " + durationText
}

private fun cargoSummary(load: NativeLoad): String {
    val values = mutableListOf<String>()
    if (!load.cargoLabel.isNullOrBlank()) values += load.cargoLabel
    if (load.pallets != null) {
        val count = if (load.pallets % 1.0 == 0.0) load.pallets.toInt().toString() else load.pallets.toString()
        values += count + if (load.pallets == 1.0) " pallet" else " pallets"
    }
    if (load.weightKg != null) {
        val weight = if (load.weightKg % 1.0 == 0.0) load.weightKg.toInt().toString() else load.weightKg.toString()
        values += weight + " kg"
    }
    return values.joinToString(" | ")
}

private fun formatMoney(amount: Double, currency: String): String {
    val symbol = if (currency.uppercase(Locale.UK) == "GBP") "Ã‚Â£" else currency + " "
    return symbol + String.format(Locale.UK, "%.2f", amount)
}








