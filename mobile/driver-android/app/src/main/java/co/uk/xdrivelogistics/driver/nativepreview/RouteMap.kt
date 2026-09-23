package co.uk.xdrivelogistics.driver.nativepreview

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import co.uk.xdrivelogistics.driver.nativepreview.model.NativeLoad
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

private data class RouteMapState(
    val pickup: GeoPoint? = null,
    val delivery: GeoPoint? = null,
    val driver: GeoPoint? = null,
    val toPickup: List<GeoPoint> = emptyList(),
    val jobRoute: List<GeoPoint> = emptyList(),
    val toPickupMiles: Double? = null,
    val toPickupMinutes: Double? = null,
    val loading: Boolean = true,
    val error: String? = null,
)

private data class OsrmRoute(
    val points: List<GeoPoint>,
    val miles: Double?,
    val minutes: Double?,
)

private val routeHttp by lazy { OkHttpClient() }

@Composable
fun RouteMapContent(load: NativeLoad) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var locationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> locationPermission = granted }
    LaunchedEffect(Unit) {
        if (!locationPermission) permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    var state by remember(load.id, locationPermission) { mutableStateOf(RouteMapState()) }
    LaunchedEffect(load.id, locationPermission) {
        state = loadRouteMap(context, load, locationPermission)
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFFE7EEF3))
    ) {
        if (state.loading) {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = androidx.compose.ui.Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (state.pickup != null && state.delivery != null) {
            val pickupPoint = state.pickup!!
            val deliveryPoint = state.delivery!!
            AndroidView(
                modifier = Modifier.fillMaxWidth().weight(1f),
                factory = { ctx ->
                    Configuration.getInstance().userAgentValue = ctx.packageName
                    MapView(ctx).apply {
                        setMultiTouchControls(true)
                        controller.setZoom(7.0)
                    }
                },
                update = { map ->
                    map.overlays.clear()
                    state.driver?.let { point ->
                        marker(map, point, "Current location")
                    }
                    marker(map, pickupPoint, "Collection")
                    marker(map, deliveryPoint, "Delivery")
                    if (state.toPickup.size > 1) {
                        Polyline().also {
                            it.setPoints(state.toPickup)
                            it.outlinePaint.strokeWidth = 8f
                            map.overlays.add(it)
                        }
                    }
                    if (state.jobRoute.size > 1) {
                        Polyline().also {
                            it.setPoints(state.jobRoute)
                            it.outlinePaint.strokeWidth = 9f
                            map.overlays.add(it)
                        }
                    }
                    val boundsPoints = buildList {
                        state.driver?.let(::add)
                        add(pickupPoint)
                        add(deliveryPoint)
                    }
                    if (boundsPoints.isNotEmpty()) {
                        val box = org.osmdroid.util.BoundingBox.fromGeoPoints(boundsPoints)
                        map.post { map.zoomToBoundingBox(box, true, 70) }
                    }
                    map.invalidate()
                }
            )
        } else {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = androidx.compose.ui.Alignment.Center) {
                Text(state.error ?: "Route map unavailable")
            }
        }
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color.White,
            shadowElevation = 8.dp
        ) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text(
                    "Distance to Pick Up",
                    fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                    fontSize = 18.sp
                )
                Text(routeMetricForMap(state.toPickupMiles ?: load.distanceToPickupMiles, state.toPickupMinutes ?: load.pickupEtaMinutes))
                Spacer(Modifier.height(8.dp))
                Text(
                    "Job Distance",
                    fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                    fontSize = 18.sp
                )
                Text(routeMetricForMap(load.jobDistanceMiles, load.jobDistanceMinutes))
                state.error?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(it, color = Color(0xFF7A4A00), fontSize = 12.sp)
                }
            }
        }
    }
}

private fun marker(map: MapView, point: GeoPoint, title: String) {
    Marker(map).also {
        it.position = point
        it.title = title
        it.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
        map.overlays.add(it)
    }
}

private suspend fun loadRouteMap(
    context: Context,
    load: NativeLoad,
    useLocation: Boolean
): RouteMapState = withContext(Dispatchers.IO) {
    runCatching {
        val pickup = geocodeOutcode(load.pickupArea)
            ?: error("Collection location could not be mapped")
        val delivery = geocodeOutcode(load.deliveryArea)
            ?: error("Delivery location could not be mapped")
        val driver = if (useLocation) lastKnownPoint(context) else null
        val jobRoute = osrmRoute(pickup, delivery)
        val toPickupRoute = driver?.let { osrmRoute(it, pickup) }
        RouteMapState(
            pickup = pickup,
            delivery = delivery,
            driver = driver,
            toPickup = toPickupRoute?.points.orEmpty(),
            jobRoute = jobRoute.points,
            toPickupMiles = toPickupRoute?.miles,
            toPickupMinutes = toPickupRoute?.minutes,
            loading = false,
            error = if (useLocation && driver == null) "Current GPS fix unavailable; showing job route." else null
        )
    }.getOrElse {
        RouteMapState(loading = false, error = it.message ?: "Route map unavailable")
    }
}
private fun geocodeOutcode(raw: String): GeoPoint? {
    val outcode = raw.trim().uppercase()
        .substringBefore(',')
        .replace(Regex("[^A-Z0-9 ]"), "")
        .trim()
        .split(Regex("\\s+"))
        .firstOrNull()
        ?.takeIf { it.isNotBlank() }
        ?: return null
    val request = Request.Builder()
        .url("https://api.postcodes.io/outcodes/$outcode")
        .header("User-Agent", "XDriveNativePreview/0.1")
        .build()
    routeHttp.newCall(request).execute().use { response ->
        if (!response.isSuccessful) return null
        val result = JSONObject(response.body?.string().orEmpty()).optJSONObject("result") ?: return null
        val lat = result.optDouble("latitude", Double.NaN)
        val lng = result.optDouble("longitude", Double.NaN)
        return if (lat.isFinite() && lng.isFinite()) GeoPoint(lat, lng) else null
    }
}

private fun osrmRoute(from: GeoPoint, to: GeoPoint): OsrmRoute {
    val url = "https://router.project-osrm.org/route/v1/driving/" +
        "${from.longitude},${from.latitude};${to.longitude},${to.latitude}" +
        "?overview=full&geometries=geojson&steps=false"
    val request = Request.Builder()
        .url(url)
        .header("User-Agent", "XDriveNativePreview/0.1")
        .build()
    routeHttp.newCall(request).execute().use { response ->
        if (!response.isSuccessful) return OsrmRoute(emptyList(), null, null)
        val root = JSONObject(response.body?.string().orEmpty())
        val route = root.optJSONArray("routes")?.optJSONObject(0)
            ?: return OsrmRoute(emptyList(), null, null)
        val coordinates = route.optJSONObject("geometry")?.optJSONArray("coordinates")
            ?: return OsrmRoute(emptyList(), null, null)
        val points = buildList {
            for (i in 0 until coordinates.length()) {
                val pair = coordinates.optJSONArray(i) ?: continue
                add(GeoPoint(pair.optDouble(1), pair.optDouble(0)))
            }
        }
        val metres = route.optDouble("distance", Double.NaN)
        val seconds = route.optDouble("duration", Double.NaN)
        return OsrmRoute(
            points = points,
            miles = if (metres.isFinite()) metres / 1609.344 else null,
            minutes = if (seconds.isFinite()) seconds / 60.0 else null,
        )
    }
}

private fun lastKnownPoint(context: Context): GeoPoint? {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) !=
        PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) !=
        PackageManager.PERMISSION_GRANTED
    ) return null
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val best: Location? = manager.getProviders(true)
        .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
        .maxByOrNull { it.time }
    return best?.let { GeoPoint(it.latitude, it.longitude) }
}

internal suspend fun calculatePickupMetric(context: Context, load: NativeLoad): Pair<Double?, Double?> =
    withContext(Dispatchers.IO) {
        runCatching {
            val pickup = geocodeOutcode(load.pickupArea) ?: return@runCatching null to null
            val driver = lastKnownPoint(context) ?: return@runCatching null to null
            val route = osrmRoute(driver, pickup)
            route.miles to route.minutes
        }.getOrElse { null to null }
    }

private fun routeMetricForMap(miles: Double?, minutes: Double?): String {
    if (miles == null) return "Not available"
    val distance = String.format(java.util.Locale.UK, "%.1f mi", miles)
    if (minutes == null || minutes <= 0) return distance
    val total = minutes.toInt()
    val h = total / 60
    val m = total % 60
    val time = when {
        h > 0 && m > 0 -> "${h} h ${m} min"
        h > 0 -> "${h} h"
        else -> "${m} min"
    }
    return "$distance · $time"
}
