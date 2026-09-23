package co.uk.xdrivelogistics.driver.nativepreview.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.nativepreview.data.AuthStore
import co.uk.xdrivelogistics.driver.nativepreview.data.XDriveApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

data class AuthUiState(
    val signedIn: Boolean,
    val loading: Boolean = false,
    val error: String? = null
)

class AuthViewModel(
    private val authStore: AuthStore,
    private val api: XDriveApi
) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState(signedIn = authStore.signedIn))
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun signIn(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = _state.value.copy(error = "Email and password are required.")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val response = api.signIn(email, password)
            if (response.successful && authStore.signedIn) {
                _state.value = AuthUiState(signedIn = true)
            } else {
                val message = runCatching {
                    val json = JSONObject(response.body)
                    json.optString("msg")
                        .ifBlank { json.optString("error_description") }
                        .ifBlank { json.optString("error") }
                }.getOrNull().orEmpty().ifBlank {
                    "Sign in failed (" + response.status + ")."
                }
                _state.value = AuthUiState(
                    signedIn = false,
                    loading = false,
                    error = message
                )
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            api.signOutLocal()
            _state.value = AuthUiState(signedIn = false)
        }
    }
}
