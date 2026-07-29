package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.SessionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * In-memory [SessionRepository] for instrumented tests.
 *
 * Provides deterministic, synchronous session control without touching
 * [androidx.security.crypto.EncryptedSharedPreferences] or the Android Keystore. The
 * [session] flow is backed by a [MutableStateFlow] and emits synchronously on the Kotlin
 * coroutine dispatcher used by [DriverViewModel]'s `viewModelScope` (Dispatchers.Main).
 *
 * Usage:
 * ```kotlin
 * val fake = FakeSessionRepository()
 * MainActivity.testViewModelFactory = DriverViewModelFactory(appCtx, fake, skipDataRefresh = true)
 * // … launch scenario …
 * fake.saveSession(ownerASession)   // ViewModel observes immediately
 * fake.clear()                       // ViewModel resets and advances authEpoch
 * ```
 *
 * Always reset [MainActivity.testViewModelFactory] to `null` in `@After`.
 */
class FakeSessionRepository : SessionRepository {
    private val _session = MutableStateFlow<DriverSession?>(null)
    override val session: Flow<DriverSession?> = _session.asStateFlow()
    override fun readSession(): DriverSession? = _session.value
    override suspend fun saveSession(session: DriverSession) { _session.value = session }
    override suspend fun clear() { _session.value = null }
}
