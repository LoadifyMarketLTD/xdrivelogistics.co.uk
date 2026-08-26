package co.uk.xdrivelogistics.driver.data

import co.uk.xdrivelogistics.driver.PendingPodUpload
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit

class SecureDriverMutationApi(
    private val xdriveBaseUrl: String,
    private val installationId: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(30, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun updateJobStatus(
        session: DriverSession,
        jobId: String,
        nextStatus: String,
    ): Result<Unit> = networkResult {
        requireConfigured()
        val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.toString())
        val body = JsonObject().apply { addProperty("nextStatus", nextStatus) }
        val request = baseRequest(
            "${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$encodedJobId/status",
            session.accessToken,
        )
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        execute(request, "Driver status update failed.")
    }

    suspend fun uploadPodEvidence(
        session: DriverSession,
        action: PendingPodUpload,
        bytes: ByteArray,
    ): Result<Unit> = networkResult {
        requireConfigured()
        require(bytes.isNotEmpty()) { "Saved POD evidence is empty." }
        val encodedJobId = URLEncoder.encode(action.jobId, StandardCharsets.UTF_8.toString())
        val mediaType = action.mimeType.toMediaType()
        val request = baseRequest(
            "${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$encodedJobId/evidence",
            session.accessToken,
        )
            .addHeader("Content-Type", action.mimeType)
            .addHeader("X-XDrive-Evidence-Kind", if (action.isCollectionProof) "collection" else "delivery")
            .addHeader("X-XDrive-Evidence-Name", action.remoteObjectName)
            .post(bytes.toRequestBody(mediaType))
            .build()
        execute(request, "Saved POD evidence could not be synced.")
    }

    suspend fun confirmDeliveryRecipient(
        session: DriverSession,
        jobId: String,
        recipientName: String,
    ): Result<Unit> = networkResult {
        requireConfigured()
        val cleanName = recipientName.trim()
        require(cleanName.isNotBlank()) { "Recipient name is required." }
        val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.toString())
        val body = JsonObject().apply { addProperty("recipientName", cleanName) }
        val request = baseRequest(
            "${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$encodedJobId/confirmation",
            session.accessToken,
        )
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        execute(request, "Failed to confirm delivery evidence.")
    }

    private fun baseRequest(url: String, accessToken: String): Request.Builder = Request.Builder()
        .url(url)
        .addHeader("Authorization", "Bearer $accessToken")
        .addHeader("X-XDrive-Installation-Id", installationId)
        .addHeader("Accept", "application/json")

    private fun execute(request: Request, fallback: String) {
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = extractError(raw, fallback)
                if ((response.code == 401 || response.code == 403) && message.isNativeBindingMessage()) {
                    throw DeviceSessionException(response.code, message)
                }
                throw IllegalStateException("HTTP ${response.code}: $message")
            }
        }
    }

    private fun String.isNativeBindingMessage(): Boolean {
        val lower = lowercase()
        return "native device" in lower ||
            "mobile session" in lower ||
            "revoked or replaced" in lower ||
            "device identity" in lower
    }

    private fun extractError(rawBody: String, fallback: String): String = runCatching {
        if (rawBody.isBlank()) fallback else {
            val json = gson.fromJson(rawBody, JsonObject::class.java)
            json.get("error")?.asString ?: json.get("message")?.asString ?: fallback
        }
    }.getOrDefault(fallback)

    private fun requireConfigured() {
        require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
        require(installationId.isNotBlank()) { "Native installation identity is missing." }
    }

    private suspend fun <T> networkResult(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) { runCatching(block) }
}
