package co.uk.xdrivelogistics.driver.data

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import co.uk.xdrivelogistics.driver.jobs.CanonicalDriverLifecycleStatus
import co.uk.xdrivelogistics.driver.jobs.DriverLifecycleTransitions
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

class ApiClient(
    private val xdriveBaseUrl: String,
    private val supabaseUrl: String,
    private val supabaseAnonKey: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        })
        .build()

    fun hasSupabaseConfig(): Boolean = supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()

    fun hasXDriveBaseUrl(): Boolean = xdriveBaseUrl.isNotBlank()

    suspend fun login(email: String, password: String): Result<DriverSession> = networkResult {
        require(hasSupabaseConfig()) { "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in BuildConfig." }

        val body = JsonObject().apply {
            addProperty("email", email)
            addProperty("password", password)
        }

        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/auth/v1/token?grant_type=password")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Login failed."))
            }

            val json = gson.fromJson(raw, JsonObject::class.java)
            val accessToken = json.get("access_token")?.asString.orEmpty()
            val refreshToken = json.get("refresh_token")?.asString.orEmpty()
            val user = json.getAsJsonObject("user")
            val userId = user?.get("id")?.asString.orEmpty()
            val userEmail = user?.get("email")?.asString ?: email

            if (accessToken.isBlank() || refreshToken.isBlank() || userId.isBlank()) {
                throw IllegalStateException("Login response is missing required auth fields.")
            }

            DriverSession(
                accessToken = accessToken,
                refreshToken = refreshToken,
                userId = userId,
                email = userEmail,
            )
        }
    }

    suspend fun refreshSession(session: DriverSession): Result<DriverSession> = networkResult {
        require(hasSupabaseConfig()) { "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in BuildConfig." }

        val body = JsonObject().apply {
            addProperty("refresh_token", session.refreshToken)
        }

        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/auth/v1/token?grant_type=refresh_token")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Your session expired. Please sign in again."))
            }

            val json = gson.fromJson(raw, JsonObject::class.java)
            val accessToken = json.get("access_token")?.asString.orEmpty()
            val refreshToken = json.get("refresh_token")?.asString ?: session.refreshToken
            val user = json.getAsJsonObject("user")
            val userId = user?.get("id")?.asString ?: session.userId
            val userEmail = user?.get("email")?.asString ?: session.email

            if (accessToken.isBlank() || refreshToken.isBlank() || userId.isBlank()) {
                throw IllegalStateException("Your session expired. Please sign in again.")
            }

            DriverSession(
                accessToken = accessToken,
                refreshToken = refreshToken,
                userId = userId,
                email = userEmail,
            )
        }
    }

    suspend fun resolveDriverProfile(session: DriverSession): Result<DriverProfile> = networkResult {
        val query = "select=id,company_id,display_name,full_name,name,email&user_id=eq.${session.userId}&limit=1"
        val request = supabaseRequest("/rest/v1/drivers?$query", session.accessToken)

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to load driver profile."))
            }

            val rows = gson.fromJson(raw, JsonArray::class.java)
            if (rows.size() == 0) {
                throw IllegalStateException("Driver account was not found for this user.")
            }

            val row = rows[0].asJsonObject
            val driverId = row.get("id")?.asString.orEmpty()
            val companyId = row.get("company_id")?.asString.orEmpty()
            val displayName = row.string("display_name")
                .ifBlank { row.string("full_name") }
                .ifBlank { row.string("name").takeUnless { it.equals("unknown", ignoreCase = true) }.orEmpty() }
                .ifBlank { row.string("email") }
                .ifBlank { session.email }
            if (driverId.isBlank() || companyId.isBlank()) {
                throw IllegalStateException("Driver profile fields are incomplete.")
            }

            val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
            val encodedCompanyId = URLEncoder.encode(companyId, StandardCharsets.UTF_8.toString())
            val vehicleRequest = supabaseRequest(
                "/rest/v1/vehicles?select=id,type,vehicle_type,make,model,registration,reg_plate,reg&assigned_driver_id=eq.$encodedDriverId&company_id=eq.$encodedCompanyId&limit=1",
                session.accessToken,
            )
            var vehicleLabel = ""
            var vehicleRegistration = ""
            val vehicleId = http.newCall(vehicleRequest).execute().use { vehicleResponse ->
                val vehicleRaw = vehicleResponse.body?.string().orEmpty()
                if (!vehicleResponse.isSuccessful) {
                    null
                } else {
                    runCatching {
                        val vehicleRows = gson.fromJson(vehicleRaw, JsonArray::class.java)
                        if (vehicleRows.size() > 0) {
                            val vehicle = vehicleRows[0].asJsonObject
                            val type = vehicle.string("vehicle_type").ifBlank { vehicle.string("type") }
                            val makeModel = listOf(vehicle.string("make"), vehicle.string("model"))
                                .filter { it.isNotBlank() }
                                .joinToString(" ")
                            vehicleRegistration = vehicle.string("registration")
                                .ifBlank { vehicle.string("reg_plate") }
                                .ifBlank { vehicle.string("reg") }
                            vehicleLabel = listOf(makeModel, type.vehicleTypeLabel())
                                .filter { it.isNotBlank() }
                                .joinToString(" - ")
                            vehicle.string("id")
                        } else {
                            null
                        }
                    }.getOrNull()
                }
            }

            DriverProfile(
                driverId = driverId,
                companyId = companyId,
                vehicleId = vehicleId,
                displayName = displayName,
                email = row.string("email").ifBlank { session.email },
                vehicleLabel = vehicleLabel,
                vehicleRegistration = vehicleRegistration,
            )
        }
    }

    suspend fun loadDriverDocuments(session: DriverSession, profile: DriverProfile): Result<List<DriverDocument>> = networkResult {
        val encodedDriverId = URLEncoder.encode(profile.driverId, StandardCharsets.UTF_8.toString())
        val driverRequest = supabaseRequest(
            "/rest/v1/driver_documents?select=id,doc_type,status,expiry_date,created_at&driver_id=eq.$encodedDriverId&order=created_at.desc",
            session.accessToken,
        )
        val driverDocs = http.newCall(driverRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to load driver documents."))
            }
            parseDocumentRows(raw, isVehicleDocument = false)
        }

        val vehicleId = profile.vehicleId
        if (vehicleId.isNullOrBlank()) return@networkResult driverDocs

        val encodedVehicleId = URLEncoder.encode(vehicleId, StandardCharsets.UTF_8.toString())
        val vehicleRequest = supabaseRequest(
            "/rest/v1/vehicle_documents?select=id,doc_type,status,expiry_date,created_at&vehicle_id=eq.$encodedVehicleId&order=created_at.desc",
            session.accessToken,
        )
        val vehicleDocs = http.newCall(vehicleRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                emptyList()
            } else {
                parseDocumentRows(raw, isVehicleDocument = true)
            }
        }

        driverDocs + vehicleDocs
    }

    suspend fun loadJobSearchPreferences(session: DriverSession, driverId: String): Result<Map<String, String>> = networkResult {
        val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
        val request = supabaseRequest(
            "/rest/v1/driver_job_search_preferences?select=job_id,state&driver_id=eq.$encodedDriverId",
            session.accessToken,
        )
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to load saved jobs."))
            }
            val rows = gson.fromJson(raw, JsonArray::class.java)
            buildMap {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    val jobId = row.string("job_id")
                    val state = row.string("state")
                    if (jobId.isNotBlank() && state.isNotBlank()) put(jobId, state)
                }
            }
        }
    }

    suspend fun loadDriverBids(session: DriverSession, profile: DriverProfile): Result<List<DriverBid>> = networkResult {
        val encodedUserId = URLEncoder.encode(session.userId, StandardCharsets.UTF_8.toString())
        val encodedDriverId = URLEncoder.encode(profile.driverId, StandardCharsets.UTF_8.toString())
        val encodedCompanyId = URLEncoder.encode(profile.companyId, StandardCharsets.UTF_8.toString())
        val select = "id,job_id,amount,bid_price_gbp,currency,status,message,created_at,jobs(pickup_location,delivery_location,pickup_datetime,client_name)"
        val request = supabaseRequest(
            "/rest/v1/job_bids?select=$select&or=(bidder_user_id.eq.$encodedUserId,bidder_driver_id.eq.$encodedDriverId,company_id.eq.$encodedCompanyId)&order=created_at.desc&limit=100",
            session.accessToken,
        )
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to load quotes."))
            }
            val rows = gson.fromJson(raw, JsonArray::class.java)
            buildList {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    val job = row.get("jobs")?.takeUnless { it.isJsonNull }?.asJsonObject
                    add(
                        DriverBid(
                            id = row.string("id"),
                            jobId = row.string("job_id"),
                            amount = row.doubleOrNull("bid_price_gbp") ?: row.doubleOrNull("amount"),
                            currency = row.string("currency").ifBlank { "GBP" },
                            status = row.string("status").ifBlank { "submitted" },
                            message = row.string("message"),
                            createdAt = row.nullableString("created_at"),
                            pickupLocation = job?.string("pickup_location").orEmpty(),
                            deliveryLocation = job?.string("delivery_location").orEmpty(),
                            pickupDatetime = job?.nullableString("pickup_datetime"),
                            clientName = job?.string("client_name").orEmpty(),
                        )
                    )
                }
            }
        }
    }

    /**
     * GET /api/driver/mobile/messages
     * Returns dispatcher messages for the authenticated driver via the server-mediated API.
     * Never reads `notification_events` or `notifications` directly via Supabase REST.
     *
     * @param before    ISO timestamp cursor of the last row on the previous page.
     * @param beforeId  UUID of the last row on the previous page. Used with [before] to
     *                  form a two-field (created_at, id) exclusive cursor that avoids
     *                  skipping rows sharing the same created_at at a page boundary.
     * @param limit     Page size (1–200, default 50).
     * @return Pair of (messages in server order, server total unread_count).
     */
    suspend fun loadDispatcherMessages(
        session: DriverSession,
        before: String? = null,
        beforeId: String? = null,
        limit: Int = 50,
    ): Result<Pair<List<DispatcherMessage>, Int>> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val params = buildString {
            append("limit=${limit.coerceIn(1, 200)}")
            if (!before.isNullOrBlank()) {
                append("&before=${URLEncoder.encode(before, StandardCharsets.UTF_8.toString())}")
            }
            if (!beforeId.isNullOrBlank()) {
                append("&before_id=${URLEncoder.encode(beforeId, StandardCharsets.UTF_8.toString())}")
            }
        }
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/messages?$params")
            .addHeader("Authorization", "******")
            .get()
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to load messages.")
            val json = gson.fromJson(raw, JsonObject::class.java)
            val unreadCount = json.get("unread_count")?.asInt ?: 0
            val messagesArray = json.getAsJsonArray("messages") ?: JsonArray()
            val messages = buildList<DispatcherMessage> {
                for (i in 0 until messagesArray.size()) {
                    val row = messagesArray[i].asJsonObject
                    add(
                        DispatcherMessage(
                            id = row.string("id"),
                            eventType = row.string("event_type"),
                            entityId = row.nullableString("entity_id"),
                            text = row.nullableString("text"),
                            jobId = row.nullableString("job_id"),
                            jobRef = row.nullableString("job_ref"),
                            read = row.get("read")?.takeIf { !it.isJsonNull }?.asBoolean
                                ?: (row.string("status").lowercase() == "read"),
                            status = row.string("status").ifBlank { "pending" },
                            createdAt = row.string("created_at"),
                        )
                    )
                }
            }
            Pair(messages, unreadCount)
        }
    }

    /**
     * POST /api/driver/mobile/messages  (body: {"id": messageId})
     * Marks a single dispatcher message as read via the server-mediated API.
     * Returns the server-confirmed unread_count so the caller never blindly
     * decrements the local count (idempotent: already-read rows return the same
     * authoritative count without error).
     * UI must only update after this call succeeds.
     */
    suspend fun markDispatcherMessageRead(
        session: DriverSession,
        messageId: String,
    ): Result<Int> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val body = JsonObject().apply { addProperty("id", messageId) }
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/messages")
            .addHeader("Authorization", "******")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to mark message read.")
            val json = gson.fromJson(raw, JsonObject::class.java)
            json.get("unread_count")?.asInt ?: 0
        }
    }

    /**
     * POST /api/driver/mobile/messages  (empty body)
     * Marks all dispatcher messages as read via the server-mediated API.
     * Returns the server-confirmed unread_count (always 0 after mark-all).
     * UI must only update after this call succeeds.
     */
    suspend fun markAllDispatcherMessagesRead(
        session: DriverSession,
    ): Result<Int> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val body = JsonObject() // empty body → server marks all messages read
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/messages")
            .addHeader("Authorization", "******")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to mark all messages read.")
            val json = gson.fromJson(raw, JsonObject::class.java)
            json.get("unread_count")?.asInt ?: 0
        }
    }

    suspend fun loadReturnJourney(session: DriverSession, driverId: String): Result<DriverReturnJourney?> = networkResult {
        val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
        val request = supabaseRequest(
            "/rest/v1/return_journeys?select=id,from_location,to_location,available_date&driver_id=eq.$encodedDriverId&order=created_at.desc&limit=1",
            session.accessToken,
        )
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to load journey."))
            val rows = gson.fromJson(raw, JsonArray::class.java)
            if (rows.size() == 0) return@networkResult null
            val row = rows[0].asJsonObject
            DriverReturnJourney(
                id = row.string("id"),
                fromLocation = row.string("from_location"),
                toLocation = row.string("to_location"),
                availableDate = row.nullableString("available_date"),
            )
        }
    }

    suspend fun saveReturnJourney(
        session: DriverSession,
        driverId: String,
        fromLocation: String,
        toLocation: String,
        availableDate: String,
    ): Result<Unit> = networkResult {
        val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
        val deleteRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/return_journeys?driver_id=eq.$encodedDriverId")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .delete()
            .build()
        http.newCall(deleteRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to replace journey."))
        }

        val body = JsonObject().apply {
            addProperty("driver_id", driverId)
            addProperty("from_location", fromLocation)
            addProperty("to_location", toLocation)
            if (availableDate.isNotBlank()) addProperty("available_date", availableDate)
        }
        val insertRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/return_journeys")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(insertRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to save journey."))
        }
    }

    suspend fun loadDriverInvoices(session: DriverSession, companyId: String): Result<List<DriverInvoice>> = networkResult {
        val encodedCompanyId = URLEncoder.encode(companyId, StandardCharsets.UTF_8.toString())
        val request = supabaseRequest(
            "/rest/v1/invoices?select=id,invoice_number,status,payment_status,total,amount,net_amount,vat_amount,currency,client_name,due_date,created_at&company_id=eq.$encodedCompanyId&order=created_at.desc&limit=50",
            session.accessToken,
        )
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to load SmartPay."))
            val rows = gson.fromJson(raw, JsonArray::class.java)
            buildList {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    val paymentStatus = row.nullableString("payment_status")
                    add(
                        DriverInvoice(
                            id = row.string("id"),
                            invoiceNumber = row.string("invoice_number").ifBlank { row.string("id").take(8).uppercase(Locale.UK) },
                            status = row.string("status"),
                            amount = row.doubleOrNull("total") ?: row.doubleOrNull("amount"),
                            currency = row.string("currency").ifBlank { "GBP" },
                            clientName = row.string("client_name"),
                            dueDate = row.nullableString("due_date"),
                            netAmount = row.doubleOrNull("net_amount"),
                            vatAmount = row.doubleOrNull("vat_amount"),
                            paymentStatus = paymentStatus,
                            issuedAt = row.nullableString("created_at"),
                        )
                    )
                }
            }
        }
    }

    suspend fun loadNearbyDrivers(session: DriverSession, companyId: String): Result<List<NearbyDriver>> = networkResult {
        val encodedCompanyId = URLEncoder.encode(companyId, StandardCharsets.UTF_8.toString())

        val driversRequest = supabaseRequest(
            "/rest/v1/drivers?select=id,display_name,name,email&company_id=eq.$encodedCompanyId",
            session.accessToken,
        )
        val driverNames = http.newCall(driversRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) emptyMap() else {
                val rows = gson.fromJson(raw, JsonArray::class.java)
                buildMap {
                    for (index in 0 until rows.size()) {
                        val row = rows[index].asJsonObject
                        val id = row.string("id")
                        if (id.isNotBlank()) {
                            put(
                                id,
                                row.string("display_name").ifBlank { row.string("name") }.ifBlank { row.string("email") }.ifBlank { "Driver" },
                            )
                        }
                    }
                }
            }
        }

        val vehiclesRequest = supabaseRequest(
            "/rest/v1/vehicles?select=assigned_driver_id,type,vehicle_type,make,model,reg_plate,registration&company_id=eq.$encodedCompanyId",
            session.accessToken,
        )
        val vehicleLabels = http.newCall(vehiclesRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) emptyMap() else {
                val rows = gson.fromJson(raw, JsonArray::class.java)
                buildMap {
                    for (index in 0 until rows.size()) {
                        val row = rows[index].asJsonObject
                        val driverId = row.string("assigned_driver_id")
                        if (driverId.isNotBlank()) {
                            val type = row.string("vehicle_type").ifBlank { row.string("type") }.vehicleTypeLabel()
                            val makeModel = listOf(row.string("make"), row.string("model")).filter { it.isNotBlank() }.joinToString(" ")
                            val reg = row.string("reg_plate").ifBlank { row.string("registration") }
                            put(driverId, listOf(makeModel, type, reg).filter { it.isNotBlank() }.joinToString(" - "))
                        }
                    }
                }
            }
        }

        val locationsRequest = supabaseRequest(
            "/rest/v1/driver_locations?select=driver_id,lat,lng,recorded_at&company_id=eq.$encodedCompanyId&order=recorded_at.desc&limit=200",
            session.accessToken,
        )
        http.newCall(locationsRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to load nearby drivers."))
            val rows = gson.fromJson(raw, JsonArray::class.java)
            val seen = mutableSetOf<String>()
            buildList {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    val driverId = row.string("driver_id")
                    if (driverId.isBlank() || !seen.add(driverId)) continue
                    add(
                        NearbyDriver(
                            driverId = driverId,
                            driverName = driverNames[driverId] ?: "Driver",
                            vehicleLabel = vehicleLabels[driverId] ?: "Vehicle TBC",
                            lat = row.doubleOrNull("lat"),
                            lng = row.doubleOrNull("lng"),
                            recordedAt = row.nullableString("recorded_at"),
                        )
                    )
                }
            }
        }
    }

    suspend fun loadNearbyMarketplaceJobs(
        session: DriverSession,
        search: String = "",
        radiusMiles: Int = 20,
        limit: Int = 100,
    ): Result<List<MarketplaceJob>> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val params = buildList {
            add("mode=destination")
            add("radius=$radiusMiles")
            add("limit=$limit")
            if (search.isNotBlank()) add("search=${URLEncoder.encode(search.trim(), StandardCharsets.UTF_8.toString())}")
        }.joinToString("&")
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/nearby-jobs?$params")
            .addHeader("Authorization", "******")
            .get()
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to load marketplace jobs.")
            val json = gson.fromJson(raw, JsonObject::class.java)
            val jobs = json.getAsJsonArray("jobs") ?: JsonArray()
            buildList {
                for (i in 0 until jobs.size()) {
                    val job = jobs[i].asJsonObject
                    val pickup = job.getAsJsonObject("pickup")
                    val delivery = job.getAsJsonObject("delivery")
                    val priceObj = job.getAsJsonObject("publicPrice")
                    val priceVisible = priceObj?.get("visible")?.asBoolean ?: false
                    add(
                        MarketplaceJob(
                            id = job.string("id"),
                            publicReference = job.string("publicReference"),
                            posterCompanyName = job.nullableString("posterCompanyName"),
                            pickupAddressSummary = pickup?.string("addressSummary").orEmpty(),
                            pickupPostcode = pickup?.string("postcode").orEmpty(),
                            pickupCollectionFrom = pickup?.nullableString("collectionFrom"),
                            deliveryAddressSummary = delivery?.string("addressSummary").orEmpty(),
                            deliveryPostcode = delivery?.string("postcode").orEmpty(),
                            deliveryFrom = delivery?.nullableString("deliveryFrom"),
                            vehicleType = job.nullableString("vehicleType"),
                            pallets = job.get("pallets")?.takeUnless { it.isJsonNull }?.let { runCatching { it.asInt }.getOrNull() },
                            weightKg = job.doubleOrNull("weightKg"),
                            freightType = job.nullableString("freightType"),
                            journeyDistanceMiles = job.doubleOrNull("journeyDistanceMiles"),
                            distanceToPickupMiles = job.doubleOrNull("distanceToPickupMiles"),
                            distanceFromCurrentDeliveryMiles = job.doubleOrNull("distanceFromCurrentDeliveryMiles"),
                            publicPrice = MarketplacePublicPrice(
                                visible = priceVisible,
                                amount = if (priceVisible) priceObj?.doubleOrNull("amount") else null,
                                currency = if (priceVisible) priceObj?.nullableString("currency") else null,
                            ),
                            hasProposedPrice = job.get("hasProposedPrice")?.asBoolean ?: false,
                            proposedPriceGbp = job.doubleOrNull("proposedPriceGbp"),
                            canQuote = job.get("canQuote")?.asBoolean ?: true,
                            canSave = job.get("canSave")?.asBoolean ?: true,
                            quoteWarning = job.nullableString("quoteWarning"),
                            destinationPriority = job.get("destinationPriority")?.asBoolean ?: false,
                            internationalEligibilityRequired = job.get("internationalEligibilityRequired")?.asBoolean ?: false,
                        )
                    )
                }
            }
        }
    }

    suspend fun loadAvailability(session: DriverSession): Result<DriverAvailability> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/availability")
            .addHeader("Authorization", "******")
            .get()
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to load availability.")
            parseAvailability(gson.fromJson(raw, JsonObject::class.java))
        }
    }

    suspend fun updateAvailabilityStatus(
        session: DriverSession,
        newStatus: DriverAvailabilityStatus,
    ): Result<DriverAvailability> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val body = gson.toJson(mapOf("availability_status" to newStatus.key))
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/availability")
            .addHeader("Authorization", "******")
            .put(body)
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to update availability.")
            parseAvailability(gson.fromJson(raw, JsonObject::class.java))
        }
    }

    suspend fun updateAvailabilitySlot(
        session: DriverSession,
        dayOfWeek: Int,
        slot: String,
        available: Boolean,
    ): Result<DriverAvailability> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val body = gson.toJson(
            mapOf(
                "slots" to listOf(
                    mapOf("day_of_week" to dayOfWeek, "slot" to slot, "available" to available)
                )
            )
        ).toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/availability")
            .addHeader("Authorization", "******")
            .put(body)
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to update slot.")
            parseAvailability(gson.fromJson(raw, JsonObject::class.java))
        }
    }

    suspend fun setJobSearchPreference(
        session: DriverSession,
        driverId: String,
        jobId: String,
        state: String?,
    ): Result<Unit> = networkResult {
        val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
        val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.toString())
        if (state == null) {
            val request = Request.Builder()
                .url("${supabaseUrl.trimEnd('/')}/rest/v1/driver_job_search_preferences?driver_id=eq.$encodedDriverId&job_id=eq.$encodedJobId")
                .addHeader("apikey", supabaseAnonKey)
                .addHeader("Authorization", "Bearer ${session.accessToken}")
                .delete()
                .build()
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException(extractError(raw, "Failed to restore job."))
                }
            }
            return@networkResult
        }

        val body = JsonObject().apply {
            addProperty("driver_id", driverId)
            addProperty("job_id", jobId)
            addProperty("state", state)
            addProperty("updated_at", java.time.Instant.now().toString())
        }
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/driver_job_search_preferences?on_conflict=driver_id,job_id")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "resolution=merge-duplicates")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to update job preference."))
            }
        }
    }

    suspend fun uploadComplianceDocument(
        session: DriverSession,
        profile: DriverProfile,
        docType: String,
        isVehicleDocument: Boolean,
        fileName: String,
        mimeType: String,
        bytes: ByteArray,
    ): Result<Unit> = networkResult {
        val safeName = fileName.ifBlank { "document" }.replace("[^a-zA-Z0-9._-]".toRegex(), "_")
        val safeDocType = docType.lowercase(Locale.UK).replace("[^a-z0-9]+".toRegex(), "_").trim('_')
        val timestamp = System.currentTimeMillis()

        val (bucket, entityId, table, idColumn) = if (isVehicleDocument) {
            val vehicleId = profile.vehicleId ?: throw IllegalStateException("No assigned vehicle found for this driver.")
            arrayOf("vehicle-docs", vehicleId, "vehicle_documents", "vehicle_id")
        } else {
            arrayOf("driver-docs", profile.driverId, "driver_documents", "driver_id")
        }

        val storagePath = "${profile.companyId}/$entityId/${safeDocType}_${timestamp}_$safeName"
        val uploadRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/storage/v1/object/$bucket/$storagePath")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("x-upsert", "false")
            .post(bytes.toRequestBody(mimeType.toMediaType()))
            .build()

        http.newCall(uploadRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to upload document."))
            }
        }

        val body = JsonObject().apply {
            addProperty(idColumn, entityId)
            addProperty("doc_type", docType)
            addProperty("file_path", storagePath)
            addProperty("status", "pending")
        }
        val insertRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/$table")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(insertRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Document uploaded but could not be linked to your profile."))
            }
        }
    }

    suspend fun loadAssignedJobs(session: DriverSession, profile: DriverProfile): Result<List<DriverJob>> = networkResult {
        val select = "id,status,current_status,pickup_location,delivery_location,pickup_datetime,delivery_datetime,client_name,client_phone,collection_contact_name,collection_contact_phone,delivery_contact_name,delivery_contact_phone,vehicle_type,cargo_type,budget_amount,load_details,delivery_photos,pod_photos,collection_photo_url,delivery_signature_data,client_signature_name,pod_required,pod_generated,distance_miles,job_distance_miles,job_distance_minutes,pickup_postcode,delivery_postcode,pallets,weight_kg,special_requirements,access_restrictions"
        val encodedDriverId = URLEncoder.encode(profile.driverId, StandardCharsets.UTF_8.toString())
        val encodedCompanyId = URLEncoder.encode(profile.companyId, StandardCharsets.UTF_8.toString())
        val query = "select=$select&or=(assigned_driver_id.eq.$encodedDriverId,assigned_company_id.eq.$encodedCompanyId,awarded_carrier_company_id.eq.$encodedCompanyId)&order=pickup_datetime.asc&limit=100"
        val request = supabaseRequest("/rest/v1/jobs?$query", session.accessToken)

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to load assigned jobs."))
            }

            val rows = gson.fromJson(raw, JsonArray::class.java)
            val jobs = buildList {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    val pickupPostcode = row.string("pickup_postcode")
                        .ifBlank { row.string("load_details").extractLoadField("postcode").orEmpty() }
                    val deliveryPostcode = row.string("delivery_postcode")
                        .ifBlank { row.string("load_details").extractLoadField("postcode", occurrence = 2).orEmpty() }
                    val distanceMiles = row.doubleOrNull("distance_miles")
                        ?: row.doubleOrNull("job_distance_miles")
                        ?: row.string("load_details").extractLoadField("distance")?.toDoubleOrNull()
                        ?: estimateDistanceMiles(pickupPostcode, deliveryPostcode)
                    val marketplaceStatus = row.string("status")
                    val operationalStatus = canonicalOperationalStatus(row.nullableString("current_status"))
                    add(
                        DriverJob(
                            id = row.string("id"),
                            status = marketplaceStatus,
                            currentStatus = operationalStatus,
                            pickupLocation = row.string("pickup_location"),
                            deliveryLocation = row.string("delivery_location"),
                            pickupDatetime = row.nullableString("pickup_datetime"),
                            deliveryDatetime = row.nullableString("delivery_datetime"),
                            clientName = row.string("client_name"),
                            clientPhone = row.string("client_phone")
                                .ifBlank { row.string("collection_contact_phone") }
                                .ifBlank { row.string("delivery_contact_phone") }
                                .ifBlank { row.string("load_details").extractLoadField("contactPhone").orEmpty() },
                            vehicleType = row.string("vehicle_type"),
                            cargoType = row.string("cargo_type"),
                            budgetAmount = row.doubleOrNull("budget_amount"),
                            loadDetails = row.string("load_details"),
                            pickupPostcode = pickupPostcode,
                            deliveryPostcode = deliveryPostcode,
                            distanceMiles = distanceMiles,
                            deliveryPhotos = parseStringArray(row.get("delivery_photos") as? JsonArray),
                            podPhotos = parseStringArray(row.get("pod_photos") as? JsonArray),
                            collectionPhotoUrl = row.nullableString("collection_photo_url"),
                            deliverySignatureData = row.get("delivery_signature_data")
                                ?.takeUnless { it.isJsonNull }
                                ?.let { gson.toJson(it) },
                            clientSignatureName = row.string("client_signature_name"),
                            podRequired = row.get("pod_required")
                                ?.takeUnless { it.isJsonNull }
                                ?.asBoolean
                                ?: true,
                            podGenerated = row.get("pod_generated")
                                ?.takeUnless { it.isJsonNull }
                                ?.asBoolean
                                ?: false,
                            pallets = row.get("pallets")?.takeUnless { it.isJsonNull }?.let { runCatching { it.asInt }.getOrNull() },
                            weightKg = row.doubleOrNull("weight_kg"),
                            specialRequirements = row.string("special_requirements"),
                            accessRestrictions = row.string("access_restrictions"),
                            estimatedDurationMinutes = row.get("job_distance_minutes")?.takeUnless { it.isJsonNull }?.let { runCatching { it.asInt }.getOrNull() },
                            collectionContactName = row.nullableString("collection_contact_name"),
                            collectionContactPhone = row.nullableString("collection_contact_phone"),
                            deliveryContactName = row.nullableString("delivery_contact_name"),
                            deliveryContactPhone = row.nullableString("delivery_contact_phone"),
                        )
                    )
                }
            }
            val activeDeliveryPostcode = jobs.firstOrNull { job ->
                !job.status.equals("posted", ignoreCase = true) &&
                    !job.currentStatus.equals("posted", ignoreCase = true) &&
                    job.deliveryPostcode.isNotBlank()
            }?.deliveryPostcode

            if (activeDeliveryPostcode.isNullOrBlank()) {
                jobs
            } else {
                jobs.map { job ->
                    if (job.status.equals("posted", ignoreCase = true) && job.pickupPostcode.isNotBlank()) {
                        job.copy(
                            pickupDistanceFromActiveDeliveryMiles = estimateDistanceMiles(
                                activeDeliveryPostcode,
                                job.pickupPostcode,
                            )
                        )
                    } else {
                        job
                    }
                }
            }
        }
    }

    suspend fun submitJobQuote(
        session: DriverSession,
        jobId: String,
        amount: Double,
        message: String,
        bidKey: String? = null,
    ): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val normalizedMessage = message.ifBlank { "Submitted from XDrive Driver Android" }.take(1_000)
        val body = JsonObject().apply {
            addProperty("jobId", jobId)
            addProperty("amount", amount)
            addProperty("message", normalizedMessage)
            addProperty("bidKey", bidKey?.trim()?.takeIf { it.isNotBlank() } ?: stableSubmissionKey("bid", jobId, session.userId))
        }
        postMobileMutation(
            accessToken = session.accessToken,
            path = "/api/driver/mobile/bids",
            body = body,
            fallbackMessage = "Failed to submit quote.",
        )
    }

    suspend fun sendQuickNote(accessToken: String, jobId: String, note: String, important: Boolean): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }

        val body = JsonObject().apply {
            addProperty("note", note)
            addProperty("visibility", if (important) "important" else "internal")
        }

        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/jobs/$jobId/notes")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to send note."))
            }
        }
    }

    suspend fun sendLocation(accessToken: String, lat: Double, lng: Double): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }

        val body = JsonObject().apply {
            addProperty("lat", lat)
            addProperty("lng", lng)
            add("heading", null)
            add("speed_mph", null)
        }

        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/location")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to publish location."))
            }
        }
    }

    suspend fun updatePassword(accessToken: String, newPassword: String): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }

        val body = JsonObject().apply { addProperty("newPassword", newPassword) }
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/password")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to update password."))
            }
        }
    }

    suspend fun updateJobStatus(
        session: DriverSession,
        jobId: String,
        nextStatus: String,
    ): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val canonicalStatus = canonicalJobStatus(nextStatus)
        val action = DriverLifecycleTransitions.mobileActionFor(canonicalStatus)
            ?: throw IllegalStateException("Unsupported lifecycle transition target: $nextStatus")
        val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.toString())
        val result = postMobileMutation(
            accessToken = session.accessToken,
            path = "/api/driver/mobile/jobs/$encodedJobId/$action",
            body = JsonObject(),
            fallbackMessage = "Failed to update job status.",
        )
        val ok = result?.get("ok")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
        if (!ok) {
            throw IllegalStateException("Status update could not be applied for this assignment.")
        }
    }

    suspend fun registerDeviceToken(
        session: DriverSession,
        token: String,
        installationId: String,
        generation: Long,
        platform: String = "android",
        appPackage: String = "co.uk.xdrivelogistics.driver",
    ): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val body = gson.toJson(
            mapOf(
                "token" to token,
                "platform" to platform,
                "app_package" to appPackage,
                "installation_id" to installationId,
                "generation" to generation,
            )
        ).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/device-token")
            .addHeader("Authorization", "******")
            .post(body)
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to register device token.")
        }
    }

    suspend fun unregisterDeviceToken(
        session: DriverSession,
        token: String,
        installationId: String,
        generation: Long,
    ): Result<Unit> = networkResult {
        require(hasXDriveBaseUrl()) { "XDRIVE_BASE_URL is missing." }
        val body = gson.toJson(
            mapOf(
                "token" to token,
                "installation_id" to installationId,
                "generation" to generation,
            )
        ).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/device-token")
            .addHeader("Authorization", "******")
            .delete(body)
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw toMobileApiException(response, raw, "Failed to unregister device token.")
        }
    }

    // =========================================================================
    // Server-mediated POD workflow (Task 3)
    // =========================================================================

    /**
     * Result returned by [initPodEvidenceUpload].
     *
     * @param path      Canonical storage path (e.g. "{jobId}/photos/{evidenceId}-file.jpg").
     *                  Use as the `photoUris` / `documentUris` / `collectionPath` value
     *                  in the finalisation call.
     * @param signedUrl Pre-signed PUT URL that the client uses to upload the bytes.
     * @param token     Upload token (may be required by the storage client SDK).
     * @param expiresIn Seconds until the signed URL expires.
     */
    data class PodUploadInitResult(
        val path: String,
        val signedUrl: String,
        val token: String,
        val expiresIn: Int,
    )

    /**
     * Request a server-issued signed upload URL for one piece of POD evidence.
     *
     * The server validates driver assignment ownership, MIME type, byte size, and
     * returns a deterministic canonical storage path. Call this before uploading
     * any evidence bytes and before modifying any local state.
     *
     * @param kind  "photos" for delivery evidence, "documents" for doc evidence,
     *              "collection" for collection-phase proof.
     */
    suspend fun initPodEvidenceUpload(
        session: DriverSession,
        jobId: String,
        podKey: String,
        evidenceId: String,
        fileName: String,
        mimeType: String,
        byteSize: Long,
        kind: String,
        sha256Hex: String,
        payloadFingerprint: String,
    ): Result<PodUploadInitResult> = networkResult {
        val requestBody = gson.toJson(
            mapOf(
                "podKey" to podKey,
                "evidenceId" to evidenceId,
                "fileName" to fileName,
                "mimeType" to mimeType,
                "byteSize" to byteSize,
                "kind" to kind,
                "sha256Hex" to sha256Hex,
                "payloadFingerprint" to payloadFingerprint,
            )
        ).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$jobId/pod-upload-init")
            .addHeader("Authorization", "******")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to initialise evidence upload."))
            }
            val json = gson.fromJson(raw, JsonObject::class.java)
            PodUploadInitResult(
                path = json.get("path")?.asString
                    ?: throw IllegalStateException("Upload init response missing 'path'."),
                signedUrl = json.get("signedUrl")?.asString
                    ?: throw IllegalStateException("Upload init response missing 'signedUrl'."),
                token = json.get("token")?.asString.orEmpty(),
                expiresIn = json.get("expiresIn")?.asInt ?: 600,
            )
        }
    }

    /**
     * Upload evidence bytes directly to a Supabase Storage signed URL.
     *
     * This is a plain HTTP PUT — no XDrive auth header is needed because the
     * signed URL already encodes the server-issued permission grant.
     */
    suspend fun uploadEvidenceBytes(
        signedUrl: String,
        bytes: ByteArray,
        mimeType: String,
    ): Result<Unit> = networkResult {
        val request = Request.Builder()
            .url(signedUrl)
            .addHeader("Content-Type", mimeType)
            .put(bytes.toRequestBody(mimeType.toMediaType()))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Evidence upload failed."))
            }
        }
    }

    /**
     * Finalise a collection proof by submitting the canonical storage path to the
     * server. The server validates assignment ownership, verifies the file exists
     * in storage, and sets `collection_photo_url` atomically.
     *
     * Idempotent: the same [podKey] replays as success.
     */
    suspend fun finaliseCollectionProof(
        session: DriverSession,
        jobId: String,
        podKey: String,
        collectionPath: String,
    ): Result<Unit> = networkResult {
        val requestBody = gson.toJson(
            mapOf("podKey" to podKey, "collectionPath" to collectionPath)
        ).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$jobId/collection-proof")
            .addHeader("Authorization", "******")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to submit collection proof."))
            }
        }
    }

    /**
     * Finalise a delivery POD by submitting all evidence, recipient name, and
     * optional signature to the server's POD endpoint.
     *
     * The server validates assignment ownership, evidence file existence in
     * storage, the recipient name requirement, and the stable submission key.
     *
     * Idempotent: same [podKey] + same [payloadFingerprint] replays as 200.
     * Same [podKey] + different [payloadFingerprint] returns 409 (conflict).
     *
     * @param podKey              Stable idempotency key for this submission.
     * @param recipientName       Name of the person who received the delivery.
     * @param signatureDataUri    Optional base64 image data URI of a drawn signature.
     * @param photoPaths          Canonical storage paths for delivery photos.
     * @param documentPaths       Canonical storage paths for POD documents.
     * @param notes               Optional delivery notes.
     * @param payloadFingerprint  Hex SHA-256 of the payload for conflict detection.
     * @return Updated [DriverJob] on success.
     */
    suspend fun finalisePod(
        session: DriverSession,
        jobId: String,
        podKey: String,
        recipientName: String,
        signatureDataUri: String?,
        photoPaths: List<String>,
        documentPaths: List<String>,
        notes: String? = null,
        payloadFingerprint: String,
    ): Result<Unit> = networkResult {
        val bodyMap = mutableMapOf<String, Any?>(
            "podKey" to podKey,
            "recipientName" to recipientName,
            "photoUris" to photoPaths,
            "documentUris" to documentPaths,
            "payloadFingerprint" to payloadFingerprint,
        )
        if (!signatureDataUri.isNullOrBlank()) bodyMap["signatureData"] = signatureDataUri
        if (!notes.isNullOrBlank()) bodyMap["notes"] = notes

        val requestBody = gson.toJson(bodyMap).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$jobId/pod")
            .addHeader("Authorization", "******")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to finalise POD submission."))
            }
        }
    }

    private fun supabaseRequest(pathAndQuery: String, accessToken: String): Request {
        require(hasSupabaseConfig()) { "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in BuildConfig." }

        return Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}$pathAndQuery")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")
            .build()
    }

    private suspend fun <T> networkResult(block: suspend () -> T): Result<T> =
        withContext(Dispatchers.IO) {
            try {
                Result.success(block())
            } catch (throwable: Throwable) {
                Result.failure(MobileApiErrorClassifier.transportFailure(throwable))
            }
        }

    private fun extractError(rawBody: String, fallback: String): String {
        if (rawBody.isBlank()) return fallback
        return runCatching {
            val json = gson.fromJson(rawBody, JsonObject::class.java)
            json.get("error")?.asString
                ?: json.get("message")?.asString
                ?: fallback
        }.getOrElse { fallback }
    }

    private fun extractErrorCode(rawBody: String): String? {
        if (rawBody.isBlank()) return null
        return runCatching {
            val json = gson.fromJson(rawBody, JsonObject::class.java)
            json.get("code")?.asString
                ?: json.get("error_code")?.asString
                ?: json.get("errorCode")?.asString
        }.getOrNull()
    }

    private fun postMobileMutation(
        accessToken: String,
        path: String,
        body: JsonObject,
        fallbackMessage: String,
    ): JsonObject? {
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}$path")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        return http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw toMobileApiException(response, raw, fallbackMessage)
            }
            runCatching { gson.fromJson(raw, JsonObject::class.java) }.getOrNull()
        }
    }

    private fun toMobileApiException(response: Response, rawBody: String, fallbackMessage: String): MobileApiHttpException {
        val serverMessage = extractError(rawBody, fallbackMessage)
        val mutationId = response.header("X-Request-Id")
            ?: response.header("x-request-id")
            ?: response.header("X-Correlation-Id")
            ?: response.header("x-correlation-id")
            ?: response.header("X-Mutation-Id")
            ?: response.header("x-mutation-id")
        val retryAfter = response.header("Retry-After") ?: response.header("retry-after")
        return MobileApiErrorClassifier.httpFailure(
            statusCode = response.code,
            fallbackMessage = fallbackMessage,
            serverMessage = serverMessage,
            errorCode = extractErrorCode(rawBody),
            mutationId = mutationId,
            retryAfterRaw = retryAfter,
        )
    }

    private fun parseStringArray(array: JsonArray?): List<String> {
        if (array == null) return emptyList()
        val values = ArrayList<String>(array.size())
        for (i in 0 until array.size()) {
            val item = array[i]
            if (item != null && !item.isJsonNull) {
                values.add(item.asString)
            }
        }
        return values
    }

    private fun parseDocumentRows(raw: String, isVehicleDocument: Boolean): List<DriverDocument> {
        val rows = gson.fromJson(raw, JsonArray::class.java)
        return buildList {
            for (index in 0 until rows.size()) {
                val row = rows[index].asJsonObject
                add(
                    DriverDocument(
                        id = row.string("id"),
                        docType = row.string("doc_type"),
                        status = row.string("status"),
                        createdAt = row.nullableString("created_at"),
                        expiryDate = row.nullableString("expiry_date"),
                        isVehicleDocument = isVehicleDocument,
                    )
                )
            }
        }
    }

    private fun parseAvailability(json: JsonObject): DriverAvailability {
        val status = DriverAvailabilityStatus.fromKey(json.string("availability_status").ifBlank { "offline" })
        val rawSlots = buildList {
            val slotsArr = json.getAsJsonArray("slots") ?: JsonArray()
            for (i in 0 until slotsArr.size()) {
                val slotObject = slotsArr[i] as? JsonObject ?: continue
                add(
                    DriverAvailabilitySlot(
                        dayOfWeek = slotObject.get("day_of_week")?.asInt ?: -1,
                        slot = slotObject.string("slot"),
                        available = slotObject.get("available")?.asBoolean ?: false,
                    )
                )
            }
        }
        return DriverAvailability(
            status = status,
            slots = normalizeAvailabilitySlots(rawSlots),
        )
    }


    private fun JsonObject.string(name: String): String {
        val value = get(name) ?: return ""
        return if (value.isJsonNull) "" else value.asString.orEmpty()
    }

    private fun JsonObject.nullableString(name: String): String? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else value.asString
    }

    private fun JsonObject.doubleOrNull(name: String): Double? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else runCatching { value.asDouble }.getOrNull()
    }

    private fun String.extractLoadField(key: String, occurrence: Int = 1): String? {
        val matches = Regex("\"$key\"\\s*:\\s*\"([^\"]+)\"", RegexOption.IGNORE_CASE).findAll(this).toList()
        return matches.getOrNull(occurrence - 1)?.groupValues?.getOrNull(1)?.takeIf { it.isNotBlank() }
    }

    private fun String.vehicleTypeLabel(): String =
        when (lowercase(Locale.UK).replace("-", "_")) {
            "swb", "swb_van", "van_small" -> "SWB Van"
            "mwb", "mwb_van" -> "MWB Van"
            "lwb", "lwb_van", "van_large" -> "LWB Van"
            "xlwb", "xlwb_van" -> "XLWB Van"
            "luton" -> "Luton"
            "luton_tail_lift" -> "Luton Tail Lift"
            "truck_3_5t" -> "3.5t Truck"
            "truck_7_5t" -> "7.5t Truck"
            else -> replace('_', ' ').split(' ').filter { it.isNotBlank() }
                .joinToString(" ") { it.replaceFirstChar { char -> char.uppercase(Locale.UK) } }
        }

    private fun estimateDistanceMiles(pickupPostcode: String, deliveryPostcode: String): Double? {
        val pickup = lookupPostcode(pickupPostcode) ?: return null
        val delivery = lookupPostcode(deliveryPostcode) ?: return null
        val straightMiles = haversineMiles(pickup.latitude, pickup.longitude, delivery.latitude, delivery.longitude)
        return ((straightMiles * 1.22) * 10.0).toInt() / 10.0
    }

    private fun lookupPostcode(postcode: String): Coordinate? {
        if (postcode.isBlank()) return null
        val encoded = URLEncoder.encode(postcode.trim(), StandardCharsets.UTF_8.toString()).replace("+", "%20")
        val request = Request.Builder()
            .url("https://api.postcodes.io/postcodes/$encoded")
            .get()
            .build()
        return runCatching {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val raw = response.body?.string().orEmpty()
                val json = gson.fromJson(raw, JsonObject::class.java)
                val result = json.getAsJsonObject("result") ?: return null
                val lat = result.doubleOrNull("latitude") ?: return null
                val lon = result.doubleOrNull("longitude") ?: return null
                Coordinate(lat, lon)
            }
        }.getOrNull()
    }

    private fun haversineMiles(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val radiusMiles = 3958.8
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2.0) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2.0)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return radiusMiles * c
    }

    private data class Coordinate(val latitude: Double, val longitude: Double)

    private fun canonicalJobStatus(driverStatus: String): String =
        CanonicalDriverLifecycleStatus.fromRaw(driverStatus)?.wireValue ?: driverStatus.lowercase()

    /**
     * Returns the canonical driver operational status from the stored current_status field only.
     * Returns empty string when current_status is absent or unrecognised — the job is
     * explicitly non-actionable. Marketplace status is never consulted as a fallback, and
     * there is no default value: 'awarded' must not be silently imposed on unresolved records.
     */
    private fun canonicalOperationalStatus(currentStatus: String?): String =
        CanonicalDriverLifecycleStatus.fromRaw(currentStatus)?.wireValue ?: ""

    private fun stableSubmissionKey(prefix: String, jobId: String, userId: String): String {
        val nonce = UUID.randomUUID().toString().replace("-", "").take(16)
        return "${prefix}_${jobId.take(24)}_${userId.take(24)}_$nonce"
    }
}
