package co.uk.xdrivelogistics.driver.nativepreview.data

import android.os.Build
import co.uk.xdrivelogistics.driver.nativepreview.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class ApiResponse(
    val status: Int,
    val body: String
) {
    val successful: Boolean get() = status in 200..299
}

class XDriveApi(
    private val authStore: AuthStore
) {
    companion object {
        private const val API_BASE = "https://www.xdrivelogistics.co.uk"
        private const val SUPABASE_URL = "https://jqxlauexhkonixtjvljw.supabase.co"
        private const val SUPABASE_KEY = "sb_publishable_yxmGBfB7tzCgBXi_6T-uJQ_JNNYmBVO"
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var deviceSessionRegistered = false

    suspend fun signIn(email: String, password: String): ApiResponse = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .toString()
            .toRequestBody(JSON)

        val request = Request.Builder()
            .url(SUPABASE_URL + "/auth/v1/token?grant_type=password")
            .header("apikey", SUPABASE_KEY)
            .header("Accept", "application/json")
            .post(body)
            .build()

        val response = execute(request)
        if (!response.successful) return@withContext response

        val json = JSONObject(response.body)
        val access = json.optString("access_token").trim()
        val refresh = json.optString("refresh_token").trim()
        if (access.isBlank()) return@withContext ApiResponse(401, "{\"error\":\"Missing access token.\"}")

        authStore.saveSession(access, refresh)
        val registration = registerNativeDeviceSession(access)
        if (!registration.successful) {
            authStore.clearSession()
            return@withContext registration
        }
        deviceSessionRegistered = true
        response
    }

    private fun registerNativeDeviceSession(accessToken: String): ApiResponse {
        val payload = JSONObject()
            .put("installation_id", authStore.installationId)
            .put("app_package", "co.uk.xdrivelogistics.driver")
            .put("device_label", Build.MANUFACTURER + " " + Build.MODEL)
            .toString()
            .toRequestBody(JSON)

        val request = Request.Builder()
            .url(API_BASE + "/api/driver/mobile/device-session")
            .header("Accept", "application/json")
            .header("Authorization", "Bearer " + accessToken)
            .header("x-xdrive-installation-id", authStore.installationId)
            .post(payload)
            .build()
        return execute(request)
    }

    private fun ensureNativeDeviceSession(accessToken: String): ApiResponse? {
        if (deviceSessionRegistered) return null
        val registration = registerNativeDeviceSession(accessToken)
        if (registration.successful) {
            deviceSessionRegistered = true
            return null
        }
        return registration
    }

    suspend fun refreshSession(): Boolean = withContext(Dispatchers.IO) {
        val refresh = authStore.refreshToken ?: return@withContext false
        val body = JSONObject()
            .put("refresh_token", refresh)
            .toString()
            .toRequestBody(JSON)

        val request = Request.Builder()
            .url(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token")
            .header("apikey", SUPABASE_KEY)
            .header("Accept", "application/json")
            .post(body)
            .build()

        val response = execute(request)
        if (!response.successful) return@withContext false

        val json = JSONObject(response.body)
        val access = json.optString("access_token").trim()
        val nextRefresh = json.optString("refresh_token").trim()
        if (access.isBlank()) return@withContext false

        authStore.saveSession(access, if (nextRefresh.isBlank()) refresh else nextRefresh)
        true
    }

    suspend fun getMarketplaceLoads(): ApiResponse =
        authorizedGet(API_BASE + "/api/driver/marketplace/loads")

    suspend fun getMarketplaceLoad(id: String): ApiResponse =
        authorizedGet(API_BASE + "/api/driver/marketplace/loads?id=" + id)

    suspend fun getQuotes(): ApiResponse =
        authorizedGet(API_BASE + "/api/driver/mobile/bids")

    suspend fun getBookings(scope: String = "active"): ApiResponse =
        authorizedGet(API_BASE + "/api/driver/mobile/jobs?scope=" + scope + "&limit=100")

    suspend fun getResources(): ApiResponse =
        authorizedGet(API_BASE + "/api/driver/mobile/resources")

    suspend fun getProfile(): ApiResponse = authorizedGet(API_BASE + "/api/driver/mobile/resources")

    suspend fun bridgeGet(path: String): ApiResponse = authorizedGet(API_BASE + path)
    suspend fun bridgePost(path: String, payload: JSONObject): ApiResponse = authorizedPost(API_BASE + path, payload)
    suspend fun bridgePut(path: String, payload: JSONObject): ApiResponse = authorizedPut(API_BASE + path, payload)
    suspend fun bridgeDelete(path: String): ApiResponse = authorizedDelete(API_BASE + path)
    suspend fun getAvailability(): ApiResponse = authorizedGet(API_BASE + "/api/driver/availability-presence")
    suspend fun getNearby(): ApiResponse = authorizedGet(API_BASE + "/api/availability/nearby")
    suspend fun getDirectory(): ApiResponse = authorizedGet(API_BASE + "/api/directory")
    suspend fun getReturnJourneys(): ApiResponse = authorizedGet(API_BASE + "/api/driver/return-journeys?scope=mine&page=1&page_size=25")
    suspend fun getLoadAlertPreferences(): ApiResponse = authorizedGet(API_BASE + "/api/driver/load-alert-preferences")
    suspend fun getMessages(): ApiResponse = authorizedGet(API_BASE + "/api/driver/messages")

    suspend fun submitQuote(
        jobId: String,
        amount: Double,
        collectWithinMinutes: Int?,
        message: String
    ): ApiResponse {
        val body = JSONObject()
            .put("jobId", jobId)
            .put("amount", amount)
            .put("collectWithinMinutes", collectWithinMinutes ?: JSONObject.NULL)
            .put("message", message)
        return authorizedPost(API_BASE + "/api/driver/mobile/bids", body)
    }

    suspend fun signOutLocal() {
        authStore.clearSession()
        authStore.clearLoadsCache()
    }

    private suspend fun authorizedGet(url: String): ApiResponse = withContext(Dispatchers.IO) {
        var token = authStore.accessToken
            ?: return@withContext ApiResponse(401, "{\"error\":\"Not signed in.\"}")
        ensureNativeDeviceSession(token)?.let { return@withContext it }

        var response = execute(
            Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + token)
                .header("x-xdrive-installation-id", authStore.installationId)
                .header(
                    "User-Agent",
                    "XDriveNativePreview/" + BuildConfig.VERSION_NAME + " (" + Build.MANUFACTURER + " " + Build.MODEL + ")"
                )
                .get()
                .build()
        )

        if (response.status == 401 && refreshSession()) {
            token = authStore.accessToken
                ?: return@withContext ApiResponse(401, "{\"error\":\"Session refresh failed.\"}")
            response = execute(
                Request.Builder()
                    .url(url)
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .header("x-xdrive-installation-id", authStore.installationId)
                    .header(
                        "User-Agent",
                        "XDriveNativePreview/" + BuildConfig.VERSION_NAME + " (" + Build.MANUFACTURER + " " + Build.MODEL + ")"
                    )
                    .get()
                    .build()
            )
        }

        if (response.status == 401) {
            val message = runCatching { JSONObject(response.body).optString("error").lowercase() }.getOrDefault("")
            val invalidAuth = message == "unauthorized" || message.contains("invalid session") || message.contains("missing bearer token")
            if (invalidAuth) authStore.clearSession()
        }
        response
    }

    suspend fun putProfile(displayName: String, phone: String): ApiResponse =
        authorizedPut(API_BASE + "/api/driver/profile", JSONObject().put("displayName", displayName).put("phone", phone))

    suspend fun postResource(payload: JSONObject): ApiResponse =
        authorizedPost(API_BASE + "/api/driver/mobile/resources", payload)

    suspend fun postAvailability(payload: JSONObject): ApiResponse =
        authorizedPost(API_BASE + "/api/driver/availability-presence", payload)

    suspend fun deleteAvailability(): ApiResponse =
        authorizedDelete(API_BASE + "/api/driver/availability-presence")

    suspend fun putFuturePosition(payload: JSONObject): ApiResponse =
        authorizedPut(API_BASE + "/api/driver/future-position", payload)

    suspend fun putLoadAlertPreferences(payload: JSONObject): ApiResponse =
        authorizedPut(API_BASE + "/api/driver/load-alert-preferences", payload)

    suspend fun postMessage(payload: JSONObject): ApiResponse =
        authorizedPost(API_BASE + "/api/driver/messages", payload)

    suspend fun postSupportTicket(payload: JSONObject): ApiResponse =
        authorizedPost(API_BASE + "/api/support/tickets", payload)

    suspend fun postReturnJourney(payload: JSONObject): ApiResponse =
        authorizedPost(API_BASE + "/api/driver/return-journeys", payload)

    suspend fun putReturnJourney(payload: JSONObject): ApiResponse =
        authorizedPut(API_BASE + "/api/driver/return-journeys", payload)

    suspend fun deleteReturnJourney(id: String): ApiResponse =
        authorizedDelete(API_BASE + "/api/driver/return-journeys?id=" + java.net.URLEncoder.encode(id, "UTF-8"))

    suspend fun postLoad(payload: JSONObject): ApiResponse =
        authorizedPost(API_BASE + "/api/jobs/create", payload)

    private suspend fun authorizedPost(url: String, payload: JSONObject): ApiResponse = withContext(Dispatchers.IO) {
        var token = authStore.accessToken
            ?: return@withContext ApiResponse(401, "{\"error\":\"Not signed in.\"}")
        ensureNativeDeviceSession(token)?.let { return@withContext it }

        fun request(currentToken: String) = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("Authorization", "Bearer " + currentToken)
            .header("x-xdrive-installation-id", authStore.installationId)
            .header(
                "User-Agent",
                "XDriveNativePreview/" + BuildConfig.VERSION_NAME + " (" + Build.MANUFACTURER + " " + Build.MODEL + ")"
            )
            .post(payload.toString().toRequestBody(JSON))
            .build()

        var response = execute(request(token))
        if (response.status == 401 && refreshSession()) {
            token = authStore.accessToken
                ?: return@withContext ApiResponse(401, "{\"error\":\"Session refresh failed.\"}")
            response = execute(request(token))
        }

        if (response.status == 401) {
            val message = runCatching { JSONObject(response.body).optString("error").lowercase() }.getOrDefault("")
            val invalidAuth = message == "unauthorized" || message.contains("invalid session") || message.contains("missing bearer token")
            if (invalidAuth) authStore.clearSession()
        }
        response
    }

    private suspend fun authorizedPut(url: String, payload: JSONObject): ApiResponse =
        authorizedWrite(url, payload, "PUT")

    private suspend fun authorizedDelete(url: String): ApiResponse =
        authorizedWrite(url, null, "DELETE")

    private suspend fun authorizedWrite(url: String, payload: JSONObject?, method: String): ApiResponse = withContext(Dispatchers.IO) {
        var token = authStore.accessToken
            ?: return@withContext ApiResponse(401, "{\"error\":\"Not signed in.\"}")
        ensureNativeDeviceSession(token)?.let { return@withContext it }

        fun request(currentToken: String): Request {
            val builder = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + currentToken)
                .header("x-xdrive-installation-id", authStore.installationId)
                .header("User-Agent", "XDriveNativePreview/" + BuildConfig.VERSION_NAME + " (" + Build.MANUFACTURER + " " + Build.MODEL + ")")
            return when (method) {
                "PUT" -> builder.put((payload ?: JSONObject()).toString().toRequestBody(JSON)).build()
                "DELETE" -> builder.delete().build()
                else -> builder.method(method, payload?.toString()?.toRequestBody(JSON)).build()
            }
        }

        var response = execute(request(token))
        if (response.status == 401 && refreshSession()) {
            token = authStore.accessToken ?: return@withContext ApiResponse(401, "{\"error\":\"Session refresh failed.\"}")
            response = execute(request(token))
        }
        response
    }

    private fun execute(request: Request): ApiResponse =
        try {
            client.newCall(request).execute().use { response ->
                ApiResponse(
                    status = response.code,
                    body = response.body?.string().orEmpty().ifBlank { "{}" }
                )
            }
        } catch (error: Exception) {
            ApiResponse(
                status = 599,
                body = JSONObject()
                    .put("error", error.message ?: error.javaClass.simpleName)
                    .toString()
            )
        }
}

