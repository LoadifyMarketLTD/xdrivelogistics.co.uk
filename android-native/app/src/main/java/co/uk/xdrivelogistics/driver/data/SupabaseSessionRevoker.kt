package co.uk.xdrivelogistics.driver.data

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Revokes the current Supabase Auth session before local driver credentials are
 * discarded. `scope=local` intentionally targets only the session represented by
 * the supplied JWT; other devices are handled by the separate device/session gate.
 */
internal class SupabaseSessionRevoker(
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

    suspend fun revoke(session: DriverSession): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()) {
                "Supabase Auth is not configured."
            }

            when (logout(session.accessToken)) {
                LogoutResult.SUCCESS -> Unit
                LogoutResult.AUTH_EXPIRED -> {
                    val refreshed = refresh(session.refreshToken)
                    if (refreshed == null) {
                        // The refresh token is no longer usable, so this session can
                        // no longer mint credentials and is effectively terminated.
                        Unit
                    } else {
                        when (logout(refreshed)) {
                            LogoutResult.SUCCESS -> Unit
                            LogoutResult.AUTH_EXPIRED -> throw IllegalStateException("Session revocation could not be confirmed.")
                            LogoutResult.RETRY -> throw IOException("Session revocation is temporarily unavailable.")
                        }
                    }
                }
                LogoutResult.RETRY -> throw IOException("Session revocation is temporarily unavailable.")
            }
        }
    }

    private fun logout(accessToken: String): LogoutResult {
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/auth/v1/logout?scope=local")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .post("{}".toRequestBody(jsonMediaType))
            .build()

        return try {
            http.newCall(request).execute().use { response ->
                when {
                    response.isSuccessful -> LogoutResult.SUCCESS
                    response.code == 401 || response.code == 403 -> LogoutResult.AUTH_EXPIRED
                    else -> LogoutResult.RETRY
                }
            }
        } catch (_: IOException) {
            LogoutResult.RETRY
        }
    }

    /** Returns a fresh access token, or null when the old refresh session is gone. */
    private fun refresh(refreshToken: String): String? {
        val body = JsonObject().apply { addProperty("refresh_token", refreshToken) }
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/auth/v1/token?grant_type=refresh_token")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        return http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                if (response.code == 400 || response.code == 401 || response.code == 403) return null
                throw IOException("Session refresh for revocation failed (${response.code}).")
            }
            val raw = response.body?.string().orEmpty()
            gson.fromJson(raw, JsonObject::class.java)
                ?.get("access_token")
                ?.takeUnless { it.isJsonNull }
                ?.asString
                ?.takeIf { it.isNotBlank() }
                ?: throw IOException("Session refresh for revocation returned no access token.")
        }
    }

    private enum class LogoutResult {
        SUCCESS,
        AUTH_EXPIRED,
        RETRY,
    }
}
