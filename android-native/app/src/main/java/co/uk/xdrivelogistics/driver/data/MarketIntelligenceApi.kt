package co.uk.xdrivelogistics.driver.data

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class MarketIntelligenceApi(
    private val xdriveBaseUrl: String,
    private val installationId: String,
) {
    private val gson = Gson()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun load(session: DriverSession, radiusMiles: Int = 30): Result<DriverMarketIntelligence> =
        withContext(Dispatchers.IO) {
            runCatching {
                require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
                require(installationId.isNotBlank()) { "Native installation identity is missing." }
                val radius = radiusMiles.coerceIn(5, 300)
                val request = Request.Builder()
                    .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/market-intelligence?radius=$radius")
                    .addHeader("Authorization", "Bearer ${session.accessToken}")
                    .addHeader("X-XDrive-Installation-Id", installationId)
                    .addHeader("Accept", "application/json")
                    .get()
                    .build()
                http.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        val message = runCatching { gson.fromJson(raw, JsonObject::class.java)?.get("error")?.asString }.getOrNull().orEmpty().ifBlank { "Market intelligence request failed." }
                        if ((response.code == 401 || response.code == 403) && message.lowercase().let { "native device" in it || "mobile session" in it || "revoked or replaced" in it }) {
                            throw DeviceSessionException(response.code, message)
                        }
                        error("HTTP ${response.code}: $message")
                    }
                    val root = gson.fromJson(raw, JsonObject::class.java) ?: JsonObject()
                    val nearby = root.getAsJsonObject("whoIsNearby") ?: JsonObject()
                    val ppm = root.getAsJsonObject("ppm") ?: JsonObject()
                    DriverMarketIntelligence(
                        radiusMiles = root.intOrNull("radiusMiles") ?: radius,
                        competition = nearby.string("competition").ifBlank { "quiet" },
                        clusters = (nearby.getAsJsonArray("clusters") ?: JsonArray()).mapClusters(),
                        ppmVisible = ppm.booleanOrNull("visible") == true,
                        ppmMedian = ppm.doubleOrNull("median"),
                        ppmLow = ppm.doubleOrNull("low"),
                        ppmHigh = ppm.doubleOrNull("high"),
                        ppmSampleCount = ppm.intOrNull("sampleCount") ?: 0,
                    )
                }
            }
        }

    private fun JsonArray.mapClusters(): List<MarketCluster> = buildList {
        for (index in 0 until size()) {
            val row = get(index).takeIf { it.isJsonObject }?.asJsonObject ?: continue
            val lat = row.doubleOrNull("latitude") ?: continue
            val lng = row.doubleOrNull("longitude") ?: continue
            val count = row.intOrNull("count") ?: continue
            if (count >= 3) add(MarketCluster(lat, lng, count))
        }
    }
    private fun JsonObject.string(name: String): String = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrDefault("") } ?: ""
    private fun JsonObject.doubleOrNull(name: String): Double? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asDouble }.getOrNull() }
    private fun JsonObject.intOrNull(name: String): Int? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asInt }.getOrNull() }
    private fun JsonObject.booleanOrNull(name: String): Boolean? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asBoolean }.getOrNull() }
}
