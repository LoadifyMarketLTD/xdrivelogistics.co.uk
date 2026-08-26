package co.uk.xdrivelogistics.driver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.SessionStore
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit

class PodSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    private val pendingStore = PendingPodStore(appContext)
    private val sessionStore = SessionStore(appContext)
    private val api = ApiClient(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
    )
    private val syncClient = DurablePodSyncClient(
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
    )

    override suspend fun doWork(): Result {
        var session = sessionStore.readSession() ?: return Result.success()
        val actions = pendingStore.pendingForUser(session.userId)
        if (actions.isEmpty()) return Result.success()

        for (action in actions) {
            val payloadResult = runCatching { pendingStore.readBytes(action) }
            if (payloadResult.isFailure) {
                val error = payloadResult.exceptionOrNull()
                val message = error?.message ?: "Saved POD evidence is missing."
                pendingStore.fail(action, message)
                notifyTerminalFailure(action.jobId, message)
                continue
            }
            val payload = payloadResult.getOrThrow()

            var upload = syncClient.sync(session.accessToken, action, payload)
            if (upload.isFailure && upload.exceptionOrNull().isPodSessionFailure()) {
                val refreshed = api.refreshSession(session)
                if (refreshed.isSuccess) {
                    session = refreshed.getOrThrow()
                    sessionStore.saveSession(session)
                    upload = syncClient.sync(session.accessToken, action, payload)
                } else {
                    val refreshError = refreshed.exceptionOrNull()
                    return if (refreshError.isRetryablePodSyncFailure()) Result.retry() else Result.success()
                }
            }

            if (upload.isSuccess) {
                pendingStore.remove(action.id)
                continue
            }

            val error = upload.exceptionOrNull()
            if (error.isRetryablePodSyncFailure()) return Result.retry()
            if (error.isPodSessionFailure()) return Result.success()

            val message = error?.message ?: "POD sync was rejected by the server."
            pendingStore.fail(action, message)
            notifyTerminalFailure(action.jobId, message)
        }

        return Result.success()
    }

    private fun notifyTerminalFailure(jobId: String, message: String) {
        runCatching {
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        FAILURE_CHANNEL_ID,
                        "POD sync",
                        NotificationManager.IMPORTANCE_DEFAULT,
                    ),
                )
            }
            val openApp = PendingIntent.getActivity(
                applicationContext,
                0,
                Intent(applicationContext, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            manager.notify(
                FAILURE_NOTIFICATION_ID,
                NotificationCompat.Builder(applicationContext, FAILURE_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_notify_error)
                    .setContentTitle("XDrive POD sync needs attention")
                    .setContentText("Job ${jobId.take(8).uppercase()}: ${message.take(120)}")
                    .setStyle(NotificationCompat.BigTextStyle().bigText(message.take(500)))
                    .setContentIntent(openApp)
                    .setAutoCancel(true)
                    .build(),
            )
        }
    }

    companion object {
        private const val FAILURE_CHANNEL_ID = "xdrive_driver_pod_sync"
        private const val FAILURE_NOTIFICATION_ID = 4604
    }
}

object PodSyncScheduler {
    private const val UNIQUE_WORK = "xdrive_pod_sync"

    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<PodSyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            UNIQUE_WORK,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}

private class DurablePodSyncClient(
    private val supabaseUrl: String,
    private val supabaseAnonKey: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun sync(accessToken: String, action: PendingPodUpload, bytes: ByteArray): kotlin.Result<Unit> = runCatching {
        require(supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()) {
            "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in BuildConfig."
        }

        uploadObject(accessToken, action, bytes)
        linkObjectToJob(accessToken, action)
    }

    private fun uploadObject(accessToken: String, action: PendingPodUpload, bytes: ByteArray) {
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/storage/v1/object/pod-docs/${action.remoteStoragePath}")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("x-upsert", "true")
            .post(bytes.toRequestBody(action.mimeType.toMediaType()))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throwPodHttp(response.code, raw, "Failed to upload saved POD evidence.")
        }
    }

    private fun linkObjectToJob(accessToken: String, action: PendingPodUpload) {
        val encodedJobId = URLEncoder.encode(action.jobId, StandardCharsets.UTF_8.toString())
        val encodedDriverId = URLEncoder.encode(action.driverId, StandardCharsets.UTF_8.toString())

        val currentRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/jobs?select=id,delivery_photos,pod_photos&id=eq.$encodedJobId&assigned_driver_id=eq.$encodedDriverId&limit=1")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")
            .build()

        val current = http.newCall(currentRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throwPodHttp(response.code, raw, "Failed to verify the POD assignment.")
            val rows = runCatching { gson.fromJson(raw, JsonArray::class.java) }.getOrNull()
            if (rows == null || rows.size() == 0) {
                throw IllegalStateException("POD evidence could not be linked to this driver assignment.")
            }
            rows[0].asJsonObject
        }

        val patchBody = JsonObject().apply {
            if (action.isCollectionProof) {
                addProperty("collection_photo_url", action.remoteStoragePath)
            } else {
                val delivery = current.stringArray("delivery_photos") + action.remoteStoragePath
                val pod = current.stringArray("pod_photos") + action.remoteStoragePath
                add("delivery_photos", gson.toJsonTree(delivery.distinct()))
                add("pod_photos", gson.toJsonTree(pod.distinct()))
            }
            addProperty("updated_at", java.time.Instant.now().toString())
        }

        val patchRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/jobs?id=eq.$encodedJobId&assigned_driver_id=eq.$encodedDriverId")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")
            .patch(gson.toJson(patchBody).toRequestBody(jsonMediaType))
            .build()

        http.newCall(patchRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throwPodHttp(response.code, raw, "POD upload succeeded, but the job link failed.")
            val rows = runCatching { gson.fromJson(raw, JsonArray::class.java) }.getOrNull()
            if (rows == null || rows.size() == 0) {
                throw IllegalStateException("POD evidence could not be linked to this driver assignment.")
            }
        }
    }

    private fun JsonObject.stringArray(name: String): List<String> {
        val value = get(name) ?: return emptyList()
        if (value.isJsonNull || !value.isJsonArray) return emptyList()
        return value.asJsonArray.mapNotNull { element ->
            runCatching { element.asString }.getOrNull()?.takeIf { it.isNotBlank() }
        }
    }

    private fun throwPodHttp(code: Int, raw: String, fallback: String): Nothing {
        val message = runCatching {
            val json = gson.fromJson(raw, JsonObject::class.java)
            json.get("error")?.asString ?: json.get("message")?.asString
        }.getOrNull().orEmpty().ifBlank { fallback }
        throw IllegalStateException("HTTP $code: $message")
    }
}

internal fun Throwable?.isRetryablePodSyncFailure(): Boolean {
    if (this == null) return false
    if (this is IOException) return true
    val text = message.orEmpty().lowercase()
    return "unable to resolve host" in text ||
        "no address associated with hostname" in text ||
        "timeout" in text ||
        "timed out" in text ||
        "connection" in text ||
        "network" in text ||
        "temporarily unavailable" in text ||
        "http 408" in text ||
        "http 425" in text ||
        "http 429" in text ||
        "http 500" in text ||
        "http 502" in text ||
        "http 503" in text ||
        "http 504" in text
}

internal fun Throwable?.isPodSessionFailure(): Boolean {
    val text = this?.message.orEmpty().lowercase()
    return "jwt" in text ||
        "token" in text ||
        "http 401" in text ||
        "unauthorized" in text ||
        "authentication required" in text ||
        "session" in text
}
