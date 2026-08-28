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
import java.time.OffsetDateTime
import java.util.concurrent.TimeUnit

data class DriverPodConfirmation(
    val recipientName: String,
    val leftAt: String = "",
    val deliveredAt: String = OffsetDateTime.now().toString(),
    val deliveryStatus: String = "completed",
    val numberOfItems: Int? = null,
    val packaging: String = "",
    val weightKg: Double? = null,
    val driverNotes: String = "",
    val signatureEvidencePath: String? = null,
)

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

    suspend fun updateJobStatus(session: DriverSession, jobId: String, nextStatus: String): Result<Unit> = networkResult {
        requireConfigured()
        val body = JsonObject().apply { addProperty("nextStatus", nextStatus) }
        execute(
            baseRequest(jobUrl(jobId, "status"), session.accessToken)
                .addHeader("Content-Type", "application/json")
                .post(gson.toJson(body).toRequestBody(jsonMediaType)).build(),
            "Driver status update failed.",
        )
    }

    suspend fun sendQuickNote(session: DriverSession, jobId: String, note: String, important: Boolean): Result<Unit> = networkResult {
        requireConfigured()
        val cleanNote = note.trim()
        require(cleanNote.isNotBlank()) { "Write a short note first." }
        require(cleanNote.length <= 2000) { "Note is too long." }
        val body = JsonObject().apply {
            addProperty("note", cleanNote)
            addProperty("visibility", if (important) "important" else "internal")
        }
        execute(
            baseRequest(jobUrl(jobId, "notes"), session.accessToken)
                .addHeader("Content-Type", "application/json")
                .post(gson.toJson(body).toRequestBody(jsonMediaType)).build(),
            "Failed to send note.",
        )
    }

    suspend fun uploadPodEvidence(session: DriverSession, action: PendingPodUpload, bytes: ByteArray): Result<Unit> = networkResult {
        requireConfigured()
        require(bytes.isNotEmpty()) { "Saved POD evidence is empty." }
        val request = baseRequest(jobUrl(action.jobId, "evidence"), session.accessToken)
            .addHeader("Content-Type", action.mimeType)
            .addHeader("X-XDrive-Evidence-Kind", if (action.isCollectionProof) "collection" else "delivery")
            .addHeader("X-XDrive-Evidence-Name", action.remoteObjectName)
            .post(bytes.toRequestBody(action.mimeType.toMediaType()))
            .build()
        execute(request, "Saved POD evidence could not be synced.")
    }

    suspend fun confirmDeliveryRecipient(session: DriverSession, jobId: String, recipientName: String): Result<Unit> =
        confirmDelivery(session, jobId, DriverPodConfirmation(recipientName = recipientName))

    suspend fun confirmDelivery(session: DriverSession, jobId: String, confirmation: DriverPodConfirmation): Result<Unit> = networkResult {
        requireConfigured()
        val cleanName = confirmation.recipientName.trim()
        require(cleanName.isNotBlank()) { "Recipient name is required." }
        require(cleanName.length <= 200) { "Recipient name is too long." }
        require(confirmation.leftAt.length <= 200) { "Left At is too long." }
        require(confirmation.packaging.length <= 200) { "Packaging description is too long." }
        require(confirmation.driverNotes.length <= 1_000) { "Driver notes are too long." }
        require(confirmation.deliveryStatus in setOf("completed", "partial", "refused", "left_safe")) { "Unsupported delivery status." }
        require(confirmation.numberOfItems == null || confirmation.numberOfItems >= 0) { "Number of items cannot be negative." }
        require(confirmation.weightKg == null || (confirmation.weightKg.isFinite() && confirmation.weightKg >= 0.0)) { "Delivery weight is invalid." }

        val body = JsonObject().apply {
            addProperty("recipientName", cleanName)
            if (confirmation.leftAt.isNotBlank()) addProperty("leftAt", confirmation.leftAt.trim())
            addProperty("deliveredAt", confirmation.deliveredAt)
            addProperty("deliveryStatus", confirmation.deliveryStatus)
            confirmation.numberOfItems?.let { addProperty("numberOfItems", it) }
            if (confirmation.packaging.isNotBlank()) addProperty("packaging", confirmation.packaging.trim())
            confirmation.weightKg?.let { addProperty("weightKg", it) }
            if (confirmation.driverNotes.isNotBlank()) addProperty("driverNotes", confirmation.driverNotes.trim())
            confirmation.signatureEvidencePath?.takeIf { it.isNotBlank() }?.let { addProperty("signatureEvidencePath", it) }
        }
        execute(
            baseRequest(jobUrl(jobId, "confirmation"), session.accessToken)
                .addHeader("Content-Type", "application/json")
                .post(gson.toJson(body).toRequestBody(jsonMediaType)).build(),
            "Failed to confirm delivery evidence.",
        )
    }

    suspend fun getCollectionPass(session: DriverSession, jobId: String): Result<DriverCollectionPass> = networkResult {
        requireConfigured()
        val root = executeJson(baseRequest(jobUrl(jobId, "collection-pass"), session.accessToken).get().build(), "Collection Pass could not be loaded.")
        parseCollectionPass(root)
    }

    suspend fun issueCollectionPass(session: DriverSession, jobId: String): Result<DriverCollectionPass> = networkResult {
        requireConfigured()
        val root = executeJson(
            baseRequest(jobUrl(jobId, "collection-pass"), session.accessToken)
                .addHeader("Content-Type", "application/json")
                .post("{}".toRequestBody(jsonMediaType)).build(),
            "Collection Pass could not be issued.",
        )
        parseCollectionPass(root)
    }

    private fun parseCollectionPass(root: JsonObject): DriverCollectionPass {
        val row = root.getAsJsonObject("collectionPass") ?: error("Collection Pass response is incomplete.")
        return DriverCollectionPass(
            jobId = row.string("jobId"),
            passCode = row.string("passCode"),
            issuedAt = row.nullableString("issuedAt"),
            expiresAt = row.nullableString("expiresAt"),
            verifiedAt = row.nullableString("verifiedAt"),
        ).also { require(it.jobId.isNotBlank() && it.passCode.isNotBlank()) { "Collection Pass response is incomplete." } }
    }

    private fun jobUrl(jobId: String, suffix: String): String {
        val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.toString())
        return "${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$encodedJobId/$suffix"
    }

    private fun baseRequest(url: String, accessToken: String): Request.Builder = Request.Builder()
        .url(url)
        .addHeader("Authorization", "Bearer $accessToken")
        .addHeader("X-XDrive-Installation-Id", installationId)
        .addHeader("Accept", "application/json")

    private fun execute(request: Request, fallback: String) { executeJson(request, fallback) }

    private fun executeJson(request: Request, fallback: String): JsonObject = http.newCall(request).execute().use { response ->
        val raw = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            val message = extractError(raw, fallback)
            if ((response.code == 401 || response.code == 403) && message.isNativeBindingMessage()) throw DeviceSessionException(response.code, "This device is no longer authorised for XDrive Driver.")
            throw IllegalStateException("HTTP ${response.code}: $message")
        }
        if (raw.isBlank()) JsonObject() else runCatching { gson.fromJson(raw, JsonObject::class.java) }.getOrNull() ?: JsonObject()
    }

    private fun String.isNativeBindingMessage(): Boolean {
        val lower = lowercase()
        return "native device" in lower || "mobile session" in lower || "revoked or replaced" in lower || "device identity" in lower
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

    private suspend fun <T> networkResult(block: () -> T): Result<T> = withContext(Dispatchers.IO) { runCatching(block) }
    private fun JsonObject.string(name: String): String = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrDefault("") } ?: ""
    private fun JsonObject.nullableString(name: String): String? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrNull() }
}
