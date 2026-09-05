package co.uk.xdrivelogistics.driver

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.LoginPreferenceStore
import co.uk.xdrivelogistics.driver.data.PasswordRecoveryApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.isDeviceSessionRevoked
import kotlinx.coroutines.launch

class LoginActivity : ComponentActivity() {
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val loginPreferences by lazy { LoginPreferenceStore(applicationContext) }
    private val api by lazy {
        ApiClient(
            xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
    private val recoveryApi by lazy {
        PasswordRecoveryApi(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
    private var recoveryUri by mutableStateOf<Uri?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        recoveryUri = intent?.data?.takeIf { it.scheme == "xdrive" && it.host == "reset-password" }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = XDriveTheme.Yellow,
                    secondary = XDriveTheme.Navy,
                    background = XDriveTheme.Background,
                    surface = XDriveTheme.Surface,
                    onPrimary = Color(0xFF05070C),
                    onSecondary = XDriveTheme.TextPrimary,
                    onBackground = XDriveTheme.TextPrimary,
                    onSurface = XDriveTheme.TextPrimary,
                ),
            ) {
                val token = PasswordRecoveryApi.recoveryAccessToken(recoveryUri)
                val recoveryError = PasswordRecoveryApi.recoveryError(recoveryUri)
                when {
                    token != null -> PasswordResetContent(
                        accessToken = token,
                        onSubmit = ::completeRecovery,
                        onBackToLogin = { recoveryUri = null },
                    )
                    recoveryError != null -> AuthErrorContent(
                        message = recoveryError,
                        onBackToLogin = { recoveryUri = null },
                    )
                    else -> LoginContent(
                        initialRememberMe = loginPreferences.rememberMe,
                        onLogin = ::performLogin,
                        onRequestReset = ::requestPasswordReset,
                    )
                }
            }
        }

        if (recoveryUri == null) {
            lifecycleScope.launch {
                val existing = sessionStore.readSession() ?: return@launch
                val validation = sessionStore.validateDeviceBinding(existing)
                if (validation.isSuccess || !validation.exceptionOrNull().isDeviceSessionRevoked()) {
                    openDriverApp()
                } else {
                    sessionStore.clear(redirectToLogin = false)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recoveryUri = intent.data?.takeIf { it.scheme == "xdrive" && it.host == "reset-password" }
    }

    private fun performLogin(
        email: String,
        password: String,
        rememberMe: Boolean,
        onResult: (Result<Unit>) -> Unit,
    ) {
        lifecycleScope.launch {
            loginPreferences.setRememberMe(rememberMe)
            val login = api.login(email.trim(), password)
            if (login.isFailure) {
                onResult(Result.failure(login.exceptionOrNull() ?: IllegalStateException("Login failed.")))
                return@launch
            }
            val session = login.getOrThrow()
            runCatching { sessionStore.saveSession(session) }
                .onSuccess {
                    onResult(Result.success(Unit))
                    openDriverApp()
                }
                .onFailure { onResult(Result.failure(it)) }
        }
    }

    private fun requestPasswordReset(email: String, onResult: (Result<Unit>) -> Unit) {
        lifecycleScope.launch { onResult(recoveryApi.requestReset(email)) }
    }

    private fun completeRecovery(accessToken: String, newPassword: String, onResult: (Result<Unit>) -> Unit) {
        lifecycleScope.launch { onResult(recoveryApi.updateRecoveredPassword(accessToken, newPassword)) }
    }

    private fun openDriverApp() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}

@Composable
private fun LoginContent(
    initialRememberMe: Boolean,
    onLogin: (String, String, Boolean, (Result<Unit>) -> Unit) -> Unit,
    onRequestReset: (String, (Result<Unit>) -> Unit) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(initialRememberMe) }
    var showPassword by remember { mutableStateOf(false) }
    var forgotMode by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

    AuthContainer {
        Text("XDrive Driver", color = XDriveTheme.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 28.sp)
        Text(
            if (forgotMode) "Reset your password" else "Sign in to your driver account",
            color = XDriveTheme.TextSecondary,
            textAlign = TextAlign.Center,
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )

        if (!forgotMode) {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    TextButton(onClick = { showPassword = !showPassword }) {
                        Text(if (showPassword) "Hide" else "Show")
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
                Text("Keep me signed in", color = XDriveTheme.TextPrimary)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { forgotMode = true; error = ""; message = "" }) {
                    Text("Forgot password?")
                }
            }

            AuthPrimaryButton(
                label = "Log In",
                busy = busy,
                enabled = email.isNotBlank() && password.isNotBlank(),
            ) {
                busy = true
                error = ""
                message = ""
                onLogin(email, password, rememberMe) { result ->
                    busy = false
                    result.onFailure { error = it.message ?: "Login failed." }
                }
            }
        } else {
            Text(
                "Enter your account email. We will send a secure password-reset link.",
                color = XDriveTheme.TextSecondary,
                fontSize = 14.sp,
            )
            AuthPrimaryButton(label = "Send reset link", busy = busy, enabled = email.isNotBlank()) {
                busy = true
                error = ""
                message = ""
                onRequestReset(email) { result ->
                    busy = false
                    result.onSuccess {
                        message = "If an account exists for this email, a reset link has been sent."
                    }.onFailure { error = it.message ?: "Password reset email could not be sent." }
                }
            }
            TextButton(onClick = { forgotMode = false; error = ""; message = "" }) {
                Text("Back to login")
            }
        }

        if (message.isNotBlank()) Text(message, color = XDriveTheme.Success, fontSize = 14.sp)
        if (error.isNotBlank()) Text(error, color = XDriveTheme.Danger, fontSize = 14.sp)
    }
}

@Composable
private fun PasswordResetContent(
    accessToken: String,
    onSubmit: (String, String, (Result<Unit>) -> Unit) -> Unit,
    onBackToLogin: () -> Unit,
) {
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var completed by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    AuthContainer {
        Text("Choose a new password", color = XDriveTheme.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 25.sp)
        if (completed) {
            Text("Password updated successfully. You can now sign in with the new password.", color = XDriveTheme.Success)
            AuthPrimaryButton(label = "Back to login", busy = false, enabled = true, onClick = onBackToLogin)
        } else {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("New password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = confirm,
                onValueChange = { confirm = it },
                label = { Text("Confirm new password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            AuthPrimaryButton(
                label = "Update password",
                busy = busy,
                enabled = password.length >= 8 && password == confirm,
            ) {
                busy = true
                error = ""
                onSubmit(accessToken, password) { result ->
                    busy = false
                    result.onSuccess { completed = true }
                        .onFailure { error = it.message ?: "Password could not be updated." }
                }
            }
            if (password.isNotBlank() && confirm.isNotBlank() && password != confirm) {
                Text("Passwords do not match.", color = XDriveTheme.Danger, fontSize = 14.sp)
            }
            if (error.isNotBlank()) Text(error, color = XDriveTheme.Danger, fontSize = 14.sp)
        }
    }
}

@Composable
private fun AuthErrorContent(message: String, onBackToLogin: () -> Unit) {
    AuthContainer {
        Text("Password reset link could not be used", color = XDriveTheme.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(message, color = XDriveTheme.Danger, textAlign = TextAlign.Center)
        AuthPrimaryButton(label = "Back to login", busy = false, enabled = true, onClick = onBackToLogin)
    }
}

@Composable
private fun AuthContainer(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(XDriveTheme.Background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
        content = content,
    )
}

@Composable
private fun AuthPrimaryButton(
    label: String,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !busy,
        modifier = Modifier.fillMaxWidth().height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = XDriveTheme.Yellow,
            contentColor = Color(0xFF05070C),
        ),
    ) {
        if (busy) CircularProgressIndicator(modifier = Modifier.height(22.dp), strokeWidth = 2.dp)
        else Text(label, fontWeight = FontWeight.Bold)
    }
}
