package co.uk.xdrivelogistics.driver.data

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Locale
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

    suspend fun loadDriverNotifications(session: DriverSession): Result<List<DriverNotification>> = networkResult {
        val encodedUserId = URLEncoder.encode(session.userId, StandardCharsets.UTF_8.toString())
        val request = supabaseRequest(
            "/rest/v1/notifications?select=id,title,body,type,read_at,created_at&user_id=eq.$encodedUserId&order=created_at.desc&limit=100",
            session.accessToken,
        )
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to load alerts."))
            }
            val rows = gson.fromJson(raw, JsonArray::class.java)
            buildList {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    add(
                        DriverNotification(
                            id = row.string("id"),
                            title = row.string("title").ifBlank { row.string("type").ifBlank { "Alert" } },
                            body = row.string("body"),
                            type = row.string("type"),
                            readAt = row.nullableString("read_at"),
                            createdAt = row.nullableString("created_at"),
                        )
                    )
                }
            }
        }
    }

    suspend fun markNotificationRead(session: DriverSession, notificationId: String): Result<Unit> = networkResult {
        val encodedId = URLEncoder.encode(notificationId, StandardCharsets.UTF_8.toString())
        val body = JsonObject().apply { addProperty("read_at", java.time.Instant.now().toString()) }
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/notifications?id=eq.$encodedId&user_id=eq.${URLEncoder.encode(session.userId, StandardCharsets.UTF_8.toString())}")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .patch(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to mark alert read."))
        }
    }

    suspend fun deleteNotification(session: DriverSession, notificationId: String): Result<Unit> = networkResult {
        val encodedId = URLEncoder.encode(notificationId, StandardCharsets.UTF_8.toString())
        val encodedUserId = URLEncoder.encode(session.userId, StandardCharsets.UTF_8.toString())
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/notifications?id=eq.$encodedId&user_id=eq.$encodedUserId")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .delete()
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to delete alert."))
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
            "/rest/v1/invoices?select=id,invoice_number,status,total,amount,currency,client_name,due_date&company_id=eq.$encodedCompanyId&order=created_at.desc&limit=50",
            session.accessToken,
        )
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to load SmartPay."))
            val rows = gson.fromJson(raw, JsonArray::class.java)
            buildList {
                for (index in 0 until rows.size()) {
                    val row = rows[index].asJsonObject
                    add(
                        DriverInvoice(
                            id = row.string("id"),
                            invoiceNumber = row.string("invoice_number").ifBlank { row.string("id").take(8).uppercase(Locale.UK) },
                            status = row.string("status"),
                            amount = row.doubleOrNull("total") ?: row.doubleOrNull("amount"),
                            currency = row.string("currency").ifBlank { "GBP" },
                            clientName = row.string("client_name"),
                            dueDate = row.nullableString("due_date"),
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
        val select = "id,status,current_status,pickup_location,delivery_location,pickup_datetime,delivery_datetime,client_name,client_phone,collection_contact_phone,delivery_contact_phone,vehicle_type,cargo_type,budget_amount,load_details,delivery_photos,pod_photos,collection_photo_url,delivery_signature_data,client_signature_name,pod_required,distance_miles,job_distance_miles,pickup_postcode,delivery_postcode"
        val encodedDriverId = URLEncoder.encode(profile.driverId, StandardCharsets.UTF_8.toString())
        val encodedCompanyId = URLEncoder.encode(profile.companyId, StandardCharsets.UTF_8.toString())
        val query = "select=$select&or=(status.eq.posted,assigned_driver_id.eq.$encodedDriverId,assigned_company_id.eq.$encodedCompanyId,awarded_carrier_company_id.eq.$encodedCompanyId)&order=pickup_datetime.asc&limit=100"
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
                    add(
                        DriverJob(
                            id = row.string("id"),
                            status = row.string("status"),
                            currentStatus = row.string("current_status"),
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
        profile: DriverProfile,
        jobId: String,
        amount: Double,
        message: String,
    ): Result<Unit> = networkResult {
        val body = JsonObject().apply {
            addProperty("job_id", jobId)
            addProperty("company_id", profile.companyId)
            addProperty("bidder_user_id", session.userId)
            addProperty("bidder_driver_id", profile.driverId)
            addProperty("amount", amount)
            addProperty("bid_price_gbp", amount)
            addProperty("currency", "GBP")
            addProperty("status", "submitted")
            addProperty("message", message.ifBlank { "Submitted from XDrive Driver Android" })
        }

        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/job_bids")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to submit quote."))
            }
        }
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
        driverId: String,
        jobId: String,
        nextStatus: String,
    ): Result<Unit> = networkResult {
        val canonicalStatus = canonicalJobStatus(nextStatus)
        val body = JsonObject().apply {
            addProperty("p_driver_id", driverId)
            addProperty("p_job_id", jobId)
            addProperty("p_next_status", canonicalStatus)
        }

        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/rpc/driver_update_job_status_atomic")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to update job status."))
            }

            val result = runCatching { gson.fromJson(raw, JsonObject::class.java) }.getOrNull()
            val ok = result?.get("ok")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
            if (!ok) {
                throw IllegalStateException("Status update could not be applied for this assignment.")
            }
        }
    }

    suspend fun uploadPodDocument(
        session: DriverSession,
        driverId: String,
        job: DriverJob,
        fileName: String,
        mimeType: String,
        bytes: ByteArray,
    ): Result<String> = networkResult {
        val safeName = fileName.ifBlank { "pod.jpg" }.replace("[^a-zA-Z0-9._-]".toRegex(), "_")
        val storagePath = "driver-$driverId/${job.id}/${System.currentTimeMillis()}-$safeName"

        val uploadRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/storage/v1/object/pod-docs/$storagePath")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("x-upsert", "false")
            .post(bytes.toRequestBody(mimeType.toMediaType()))
            .build()

        http.newCall(uploadRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to upload POD document."))
            }
        }

        val patchBody = JsonObject().apply {
            if (job.needsCollectionProof()) {
                addProperty("collection_photo_url", storagePath)
            } else {
                val nextDeliveryPhotos = (job.deliveryPhotos + storagePath).distinct()
                val nextPodPhotos = (job.podPhotos + storagePath).distinct()
                add("delivery_photos", gson.toJsonTree(nextDeliveryPhotos))
                add("pod_photos", gson.toJsonTree(nextPodPhotos))
            }
            addProperty("updated_at", java.time.Instant.now().toString())
        }

        val encodedJobId = URLEncoder.encode(job.id, StandardCharsets.UTF_8.toString())
        val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
        val patchRequest = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/jobs?id=eq.$encodedJobId&assigned_driver_id=eq.$encodedDriverId")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")
            .patch(gson.toJson(patchBody).toRequestBody(jsonMediaType))
            .build()

        http.newCall(patchRequest).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "POD upload succeeded, but job update failed."))
            }
        }

        storagePath
    }

    suspend fun confirmDeliveryRecipient(
        session: DriverSession,
        driverId: String,
        job: DriverJob,
        recipientName: String,
    ): Result<Unit> = networkResult {
        val evidencePath = (job.podPhotos + job.deliveryPhotos).lastOrNull()
            ?: throw IllegalStateException("Upload the signed POD evidence first.")
        val confirmation = JsonObject().apply {
            addProperty("type", "signed_pod_evidence")
            addProperty("evidence_path", evidencePath)
            addProperty("recipient_name", recipientName)
            addProperty("confirmed_at", java.time.Instant.now().toString())
            addProperty("source", "xdrive_driver_android")
        }
        val patchBody = JsonObject().apply {
            addProperty("client_signature_name", recipientName)
            add("delivery_signature_data", confirmation)
            addProperty("updated_at", java.time.Instant.now().toString())
        }
        val encodedJobId = URLEncoder.encode(job.id, StandardCharsets.UTF_8.toString())
        val encodedDriverId = URLEncoder.encode(driverId, StandardCharsets.UTF_8.toString())
        val request = Request.Builder()
            .url("${supabaseUrl.trimEnd('/')}/rest/v1/jobs?id=eq.$encodedJobId&assigned_driver_id=eq.$encodedDriverId")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")
            .patch(gson.toJson(patchBody).toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to confirm delivery evidence."))
            }
            val rows = runCatching { gson.fromJson(raw, JsonArray::class.java) }.getOrNull()
            if (rows == null || rows.size() == 0) {
                throw IllegalStateException("Delivery evidence could not be linked to this assignment.")
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

    private suspend fun <T> networkResult(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) {
            runCatching(block)
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
        when (driverStatus.lowercase()) {
            "accepted", "assigned" -> "allocated"
            "arrived_pickup" -> "on_site_pickup"
            "on_my_way_to_pickup" -> "on_my_way"
            "loaded" -> "loaded"
            "on_route_delivery", "on_my_way_to_delivery" -> "in_transit"
            "arrived_delivery" -> "on_site_delivery"
            "delivered" -> "delivered"
            "completed" -> "completed"
            else -> driverStatus
        }
}
