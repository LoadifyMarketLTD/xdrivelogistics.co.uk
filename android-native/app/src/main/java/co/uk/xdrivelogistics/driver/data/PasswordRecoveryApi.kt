package co.uk.xdrivelogistics.driver.data

import android.net.Uri
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

class PasswordRecoveryApi(
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

    suspend fun requestReset(email: String): Result<Unit> = networkResult {
        requireConfigured()
        val cleanEmail = email.trim()
        require(cleanEmail.isNotBlank()) { "Enter your email address." }
        val redirect = URLEncoder.encode(REDIRECT_URI, StandardCharsets.UTF_8.toString())
        val body = JsonObject().apply { addProperty("email", cleanEmail) }
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/auth/v1/recover?redirect_to=$redirect")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        execute(request, "Password reset email could not be sent.")
    }

    suspend fun updateRecoveredPassword(accessToken: String, newPassword: String): Result<Unit> = networkResult {
        requireConfigured()
        require(accessToken.isNotBlank()) { "Password recovery session is missing." }
        require(newPassword.length >= 8) { "Password must contain at least 8 characters." }
        val body = JsonObject().apply { addProperty("password", newPassword) }
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/auth/v1/user")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .put(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        execute(request, "Password could not be updated.")
    }

    private fun execute(request: Request, fallback: String) {
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching {
                    gson.fromJson(raw, JsonObject::class.java)
                        ?.get("msg")?.takeUnless { it.isJsonNull }?.asString
                        ?: gson.fromJson(raw, JsonObject::class.java)
                            ?.get("error_description")?.takeUnless { it.isJsonNull }?.asString
                }.getOrNull().orEmpty().ifBlank { fallback }
                throw IllegalStateException(message)
            }
        }
    }

    private fun requireConfigured() {
        require(supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()) {
            "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in BuildConfig."
        }
    }

    private suspend fun <T> networkResult(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) { runCatching(block) }

    companion object {
        const val REDIRECT_URI = "xdrive://reset-password"

        fun recoveryAccessToken(uri: Uri?): String? {
            if (uri == null || uri.scheme != "xdrive" || uri.host != "reset-password") return null
            val fragment = uri.fragment.orEmpty()
            if (fragment.isBlank()) return null
            return fragment.split('&')
                .mapNotNull { part ->
                    val pieces = part.split('=', limit = 2)
                    if (pieces.size == 2) Uri.decode(pieces[0]) to Uri.decode(pieces[1]) else null
                }
                .toMap()
                .takeIf { it["type"] == "recovery" }
                ?.get("access_token")
                ?.takeIf { it.isNotBlank() }
        }

        fun recoveryError(uri: Uri?): String? {
            if (uri == null || uri.scheme != "xdrive" || uri.host != "reset-password") return null
            val fragment = uri.fragment.orEmpty()
            if (fragment.isBlank()) return null
            val values = fragment.split('&')
                .mapNotNull { part ->
                    val pieces = part.split('=', limit = 2)
                    if (pieces.size == 2) Uri.decode(pieces[0]) to Uri.decode(pieces[1]) else null
                }
                .toMap()
            return values["error_description"]?.takeIf { it.isNotBlank() }
        }
    }
}
