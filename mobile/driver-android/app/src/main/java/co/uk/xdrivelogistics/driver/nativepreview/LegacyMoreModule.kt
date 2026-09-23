package co.uk.xdrivelogistics.driver.nativepreview

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import co.uk.xdrivelogistics.driver.nativepreview.data.ApiResponse
import co.uk.xdrivelogistics.driver.nativepreview.data.XDriveApi
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import kotlin.concurrent.thread

class XDriveLegacyBridge(private val api: XDriveApi) {
    @Volatile private var webView: WebView? = null
    fun attach(view: WebView) { webView = view }

    private fun parsedBody(raw: String): Any =
        runCatching { JSONObject(raw) }.getOrElse {
            runCatching { JSONArray(raw) }.getOrElse { raw }
        }

    private fun encoded(r: ApiResponse) =
        JSONObject().put("status", r.status).put("body", parsedBody(r.body)).toString()

    private fun deliverAsync(requestId: String, responseJson: String) {
        val payload = JSONObject()
            .put("type", "xdrive:api-result")
            .put("requestId", requestId)
            .put("response", runCatching { JSONObject(responseJson) }.getOrElse {
                JSONObject().put("status", 500).put("body", JSONObject().put("error", "Invalid native response."))
            })
            .toString()
        webView?.post {
            val quoted = JSONObject.quote(payload)
            webView?.evaluateJavascript(
                "window.postMessage(JSON.parse($quoted), '*');" +
                    "if(window.__XDriveNativeResult){try{window.__XDriveNativeResult(JSON.parse($quoted));}catch(e){}}",
                null
            )
        }
    }
    @JavascriptInterface fun apiGet(path: String): String = runBlocking { encoded(api.bridgeGet(path)) }
    @JavascriptInterface fun apiGetCached(path: String): String = apiGet(path)
    @JavascriptInterface fun apiBatchGet(pathsJson: String): String = runBlocking {
        val paths = runCatching { JSONArray(pathsJson) }.getOrElse { JSONArray() }
        val responses = JSONObject()
        var unauthorized = false
        for (i in 0 until paths.length()) {
            val path = paths.optString(i)
            if (path.isBlank()) continue
            val response = api.bridgeGet(path)
            if (response.status == 401) unauthorized = true
            val body = runCatching { JSONObject(response.body) }.getOrElse { response.body }
            responses.put(path, JSONObject().put("status", response.status).put("body", body))
        }
        JSONObject().put("status", if (unauthorized) 401 else 200)
            .put("body", JSONObject().put("responses", responses)).toString()
    }
    @JavascriptInterface fun apiPost(path: String, body: String): String = runBlocking { encoded(api.bridgePost(path, JSONObject(body.ifBlank { "{}" }))) }
    @JavascriptInterface fun apiPut(path: String, body: String): String = runBlocking { encoded(api.bridgePut(path, JSONObject(body.ifBlank { "{}" }))) }
    @JavascriptInterface fun apiDelete(path: String): String = runBlocking { encoded(api.bridgeDelete(path)) }
    @JavascriptInterface fun apiPostReliable(path: String, body: String, key: String): String = apiPost(path, body)

    @JavascriptInterface fun apiGetAsync(requestId: String, path: String) {
        thread(name = "xdrive-api-get") {
            deliverAsync(requestId, runBlocking { encoded(api.bridgeGet(path)) })
        }
    }

    @JavascriptInterface fun apiPostAsync(requestId: String, path: String, body: String) {
        thread(name = "xdrive-api-post") {
            deliverAsync(requestId, runBlocking {
                encoded(api.bridgePost(path, JSONObject(body.ifBlank { "{}" })))
            })
        }
    }

    @JavascriptInterface fun prewarmCoreData(): String {
        thread(name = "xdrive-prewarm") { runBlocking { api.getResources() } }
        return "{\"status\":202,\"body\":{\"ok\":true}}"
    }

    @JavascriptInterface fun appDiagnostics(): String =
        JSONObject().put("status", 200).put("body", JSONObject()
            .put("package", "co.uk.xdrivelogistics.driver.nativepreview")
            .put("pendingActions", 0)
            .put("pendingLocations", 0)
        ).toString()

    @JavascriptInterface fun signIn(email: String, password: String): String =
        runBlocking { encoded(api.signIn(email, password)) }

    @JavascriptInterface fun signOut(): String = runBlocking {
        api.signOutLocal()
        "{\"status\":200,\"body\":{\"ok\":true}}"
    }

    @JavascriptInterface fun flushOfflineActions(): String = "{\"status\":200,\"body\":{\"ok\":true,\"pending\":0}}"
    @JavascriptInterface fun offlineActionCount(): Int = 0
}
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LegacyMoreModule(page: String, api: XDriveApi) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = true
                val bridge = XDriveLegacyBridge(api)
                bridge.attach(this)
                addJavascriptInterface(bridge, "XDriveNative")
                webViewClient = WebViewClient()
                loadUrl("file:///android_asset/www/" + page)
            }
        },
        update = { view ->
            val wanted = "file:///android_asset/www/" + page
            if (view.url != wanted) view.loadUrl(wanted)
        }
    )
}
