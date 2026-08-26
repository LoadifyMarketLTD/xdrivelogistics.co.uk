package co.uk.xdrivelogistics.driver.data

import android.os.Build
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class DeviceSessionApi(
    private val xdriveBaseUrl: String,
    private val installationId: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun register(session: DriverSession): Result<Unit> = networkResult {
        requireBaseUrl()
        val body = JsonObject().apply {
            addProperty("installation_id", installationId)
            addProperty("app_package", "co.uk.xdrivelogistics.driver")
            addProperty("device_label", "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(120))
        }
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/device-session")
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        execute(request, "Mobile device session could not be registered.")
    }

    suspend fun validate(session: DriverSession): Result<Unit> = networkResult {
        requireBaseUrl()
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/device-session")
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("X-XDrive-Installation-Id", installationId)
            .addHeader("Accept", "application/json")
            .get()
            .build()
        execute(request, "Mobile device session is no longer active.")
    }

    suspend fun revoke(session: DriverSession): Result<Unit> = networkResult {
        requireBaseUrl()
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/device-session")
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("X-XDrive-Installation-Id", installationId)
            .addHeader("Accept", "application/json")
            .delete()
            .build()
        execute(request, "Mobile device session could not be revoked.")
    }

    private fun execute(request: Request, fallback: String) {
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching {
                    gson.fromJson(raw, JsonObject::class.java)
                        ?.get("error")
                        ?.takeUnless { it.isJsonNull }
                        ?.asString
                }.getOrNull().orEmpty().ifBlank { fallback }
                throw DeviceSessionException(response.code, message)
            }
        }
    }

    private fun requireBaseUrl() {
        require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
    }

    private suspend fun <T> networkResult(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) { runCatching(block) }
}

class DeviceSessionException(
    val httpCode: Int,
    val serverDetail: String,
) : IllegalStateException(
    if (httpCode == 401 || httpCode == 403) {
        "This device is no longer authorised for XDrive Driver."
    } else {
        serverDetail
    },
)

fun Throwable?.isDeviceSessionRevoked(): Boolean =
    this is DeviceSessionException && (httpCode == 401 || httpCode == 403)
