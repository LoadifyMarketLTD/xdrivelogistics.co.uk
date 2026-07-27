package co.uk.xdrivelogistics.driver.offline

import java.security.MessageDigest
import java.util.Locale

enum class MobileMutationEndpoint(val path: String) {
    ACCEPT("accept"),
    ON_MY_WAY_PICKUP("on-my-way-pickup"),
    ARRIVED_PICKUP("arrived-pickup"),
    LOADED("loaded"),
    ON_MY_WAY_DELIVERY("on-my-way-delivery"),
    ARRIVED_DELIVERY("arrived-delivery"),
    DELIVERED("delivered"),
    BID("bids"),
    POD("pod"),
    ;

    companion object {
        fun fromPath(path: String): MobileMutationEndpoint? = entries.firstOrNull { it.path == path }
    }
}

enum class MobileQueueState {
    PENDING,
    SYNCING,
    SYNCED,
    BLOCKED,
    PERMANENT_FAILURE,
}

enum class MobileMutationKind {
    LIFECYCLE,
    BID,
    POD,
}

data class MobileBidPayload(
    val amount: Double,
    val currency: String,
    val message: String,
    val bidKey: String,
)

data class MobilePodPayload(
    val evidencePath: String,
    val recipientName: String? = null,
)

data class MobileQueueItem(
    val id: String,
    val ownerUserId: String,
    val driverId: String,
    val jobId: String,
    val command: MobileLifecycleCommand,
    val mutationKey: String,
    val payloadFingerprint: String,
    val sequence: Long,
    val createdAtEpochMs: Long,
    val state: MobileQueueState = MobileQueueState.PENDING,
    val attempts: Int = 0,
    val lastError: String = "",
    val leaseExpiresAtEpochMs: Long? = null,
    val updatedAtEpochMs: Long,
) {
    val endpoint: String
        get() = command.endpointPath().orEmpty()
}

enum class MobileLifecycleAction(val endpointPath: String, val targetStatus: String) {
    ACCEPT(MobileMutationEndpoint.ACCEPT.path, "accepted"),
    ON_MY_WAY_PICKUP(MobileMutationEndpoint.ON_MY_WAY_PICKUP.path, "on_my_way_to_pickup"),
    ARRIVED_PICKUP(MobileMutationEndpoint.ARRIVED_PICKUP.path, "on_site_pickup"),
    LOADED(MobileMutationEndpoint.LOADED.path, "loaded"),
    ON_MY_WAY_DELIVERY(MobileMutationEndpoint.ON_MY_WAY_DELIVERY.path, "on_my_way_to_delivery"),
    ARRIVED_DELIVERY(MobileMutationEndpoint.ARRIVED_DELIVERY.path, "on_site_delivery"),
    DELIVERED(MobileMutationEndpoint.DELIVERED.path, "delivered"),
    ;

    companion object {
        fun fromEndpoint(endpointPath: String): MobileLifecycleAction? = entries.firstOrNull { it.endpointPath == endpointPath }
        fun fromTargetStatus(targetStatus: String): MobileLifecycleAction? = entries.firstOrNull { it.targetStatus == targetStatus }
    }
}

data class MobileLifecycleCommand(
    val kind: MobileMutationKind? = null,
    val action: MobileLifecycleAction? = null,
    val targetStatus: String? = null,
    val bid: MobileBidPayload? = null,
    val pod: MobilePodPayload? = null,
) {
    fun inferredKind(): MobileMutationKind? = when {
        kind != null -> kind
        action != null -> MobileMutationKind.LIFECYCLE
        bid != null -> MobileMutationKind.BID
        pod != null -> MobileMutationKind.POD
        else -> null
    }

    fun endpointPath(): String? = when (inferredKind()) {
        MobileMutationKind.LIFECYCLE -> action?.endpointPath
        MobileMutationKind.BID -> MobileMutationEndpoint.BID.path
        MobileMutationKind.POD -> MobileMutationEndpoint.POD.path
        null -> null
    }

    fun syncTargetLabel(): String = when (inferredKind()) {
        MobileMutationKind.LIFECYCLE -> targetStatus.orEmpty()
        MobileMutationKind.BID -> "bid_submitted"
        MobileMutationKind.POD -> "pod_submitted"
        null -> ""
    }

    fun fingerprintFields(): List<String>? = when (inferredKind()) {
        MobileMutationKind.LIFECYCLE -> {
            val lifecycleAction = action ?: return null
            val lifecycleTarget = targetStatus?.trim().orEmpty()
            listOf(
                MobileMutationKind.LIFECYCLE.name,
                lifecycleAction.name,
                lifecycleTarget,
            )
        }
        MobileMutationKind.BID -> {
            val bidPayload = bid ?: return null
            listOf(
                MobileMutationKind.BID.name,
                java.math.BigDecimal.valueOf(bidPayload.amount).stripTrailingZeros().toPlainString(),
                bidPayload.currency.trim().uppercase(Locale.ROOT),
                bidPayload.message.trim(),
                bidPayload.bidKey.trim(),
            )
        }
        MobileMutationKind.POD -> {
            val podPayload = pod ?: return null
            listOf(
                MobileMutationKind.POD.name,
                podPayload.evidencePath.trim(),
                podPayload.recipientName?.trim().orEmpty(),
            )
        }
        null -> null
    }

    companion object {
        fun create(action: MobileLifecycleAction, targetStatus: String): MobileLifecycleCommand {
            require(action.targetStatus == targetStatus) { "Queue lifecycle command is not allowed." }
            return MobileLifecycleCommand(
                kind = MobileMutationKind.LIFECYCLE,
                action = action,
                targetStatus = targetStatus,
            )
        }

        fun createBid(
            amount: Double,
            currency: String,
            message: String,
            bidKey: String,
        ): MobileLifecycleCommand {
            require(amount > 0.0) { "Queue bid amount must be positive." }
            val normalizedCurrency = currency.trim().uppercase(Locale.ROOT)
            require(normalizedCurrency.length == 3) { "Queue bid currency must be ISO-4217." }
            val normalizedKey = bidKey.trim()
            require(normalizedKey.isNotBlank()) { "Queue bid key is required." }
            val normalizedMessage = message.trim().ifBlank { "Submitted from XDrive Driver Android" }.take(1_000)
            return MobileLifecycleCommand(
                kind = MobileMutationKind.BID,
                bid = MobileBidPayload(
                    amount = amount,
                    currency = normalizedCurrency,
                    message = normalizedMessage,
                    bidKey = normalizedKey,
                ),
            )
        }

        fun fromEndpointAndStatus(endpoint: String, targetStatus: String): MobileLifecycleCommand? {
            val action = MobileLifecycleAction.fromEndpoint(endpoint) ?: return null
            return runCatching { create(action, targetStatus) }.getOrNull()
        }

        fun isValid(command: MobileLifecycleCommand?): Boolean {
            if (command == null) return false
            return when (command.inferredKind()) {
                MobileMutationKind.LIFECYCLE -> {
                    val lifecycleAction = command.action ?: return false
                    lifecycleAction.targetStatus == command.targetStatus
                }
                MobileMutationKind.BID -> {
                    val bidPayload = command.bid ?: return false
                    bidPayload.amount > 0.0 &&
                        bidPayload.currency.trim().length == 3 &&
                        bidPayload.bidKey.trim().isNotBlank()
                }
                MobileMutationKind.POD -> {
                    val podPayload = command.pod ?: return false
                    podPayload.evidencePath.trim().isNotBlank()
                }
                null -> false
            }
        }

    }
}

class MobileOfflineQueue(private val nowEpochMs: () -> Long = { System.currentTimeMillis() }) {
    private var nextSequence = 1L
    private val items = mutableListOf<MobileQueueItem>()
    private val quarantined = mutableListOf<MobileQueueItem>()

    fun restore(restored: List<MobileQueueItem>) {
        items.clear()
        quarantined.clear()
        val valid = restored.filter { item ->
            val accepted = runCatching { validateStoredItem(item) }.getOrDefault(false)
            if (!accepted) quarantined += item
            accepted
        }
        items.addAll(valid.sortedBy { it.sequence })
        nextSequence = (items.maxOfOrNull { it.sequence } ?: 0L) + 1L
    }

    fun snapshot(): List<MobileQueueItem> = items.sortedBy { it.sequence }
    fun quarantinedSnapshot(): List<MobileQueueItem> = quarantined.toList()

    fun enqueue(
        ownerUserId: String,
        driverId: String,
        jobId: String,
        command: MobileLifecycleCommand,
        mutationKey: String,
    ): MobileQueueItem {
        require(ownerUserId.isNotBlank()) { "Queue owner is required." }
        require(driverId.isNotBlank()) { "Queue driver id is required." }
        require(jobId.isNotBlank()) { "Queue job id is required." }
        require(mutationKey.isNotBlank()) { "Queue mutation key is required." }
        require(MobileLifecycleCommand.isValid(command)) { "Queue mutation payload is invalid." }

        val duplicate = items.firstOrNull {
            it.ownerUserId == ownerUserId &&
                it.state in setOf(MobileQueueState.PENDING, MobileQueueState.SYNCING) &&
                it.mutationKey == mutationKey
        }
        if (duplicate != null) return duplicate

        val now = nowEpochMs()
        val item = MobileQueueItem(
            id = "${ownerUserId.take(12)}-${nextSequence}",
            ownerUserId = ownerUserId,
            driverId = driverId,
            jobId = jobId,
            command = command,
            mutationKey = mutationKey,
            payloadFingerprint = fingerprint(ownerUserId, driverId, jobId, command, mutationKey),
            sequence = nextSequence++,
            createdAtEpochMs = now,
            updatedAtEpochMs = now,
        )
        items += item
        return item
    }

    fun recoverAbandonedSyncLeases() {
        val now = nowEpochMs()
        val recovered = items.map { item ->
            if (item.state == MobileQueueState.SYNCING && (item.leaseExpiresAtEpochMs ?: Long.MAX_VALUE) <= now) {
                item.copy(
                    state = MobileQueueState.PENDING,
                    leaseExpiresAtEpochMs = null,
                    updatedAtEpochMs = now,
                )
            } else {
                item
            }
        }
        items.clear()
        items.addAll(recovered)
    }

    fun nextProcessable(ownerUserId: String, leaseDurationMs: Long): MobileQueueItem? {
        recoverAbandonedSyncLeases()
        val sorted = items
            .filter { it.ownerUserId == ownerUserId }
            .sortedBy { it.sequence }
        val syncingJobs = sorted.filter { it.state == MobileQueueState.SYNCING }.map { it.jobId }.toSet()
        for (candidate in sorted) {
            if (candidate.state != MobileQueueState.PENDING) continue
            if (candidate.jobId in syncingJobs) continue
            val olderForJob = sorted.filter { it.jobId == candidate.jobId && it.sequence < candidate.sequence }
            if (olderForJob.any { it.state in setOf(MobileQueueState.PENDING, MobileQueueState.SYNCING, MobileQueueState.BLOCKED, MobileQueueState.PERMANENT_FAILURE) }) {
                continue
            }
            val now = nowEpochMs()
            val syncing = candidate.copy(
                state = MobileQueueState.SYNCING,
                leaseExpiresAtEpochMs = now + leaseDurationMs,
                updatedAtEpochMs = now,
            )
            replace(syncing)
            return syncing
        }
        return null
    }

    fun markSynced(itemId: String) {
        val now = nowEpochMs()
        val existing = items.firstOrNull { it.id == itemId } ?: return
        replace(existing.copy(state = MobileQueueState.SYNCED, leaseExpiresAtEpochMs = null, updatedAtEpochMs = now))
    }

    fun markFailure(itemId: String, retryable: Boolean, message: String) {
        val now = nowEpochMs()
        val current = items.firstOrNull { it.id == itemId } ?: return
        val state = if (retryable) MobileQueueState.PENDING else MobileQueueState.PERMANENT_FAILURE
        replace(
            current.copy(
                state = state,
                attempts = current.attempts + 1,
                lastError = message.take(500),
                leaseExpiresAtEpochMs = null,
                updatedAtEpochMs = now,
            )
        )
        if (!retryable) {
            val blocked = items.map { item ->
                if (item.ownerUserId == current.ownerUserId &&
                    item.jobId == current.jobId &&
                    item.sequence > current.sequence &&
                    item.state == MobileQueueState.PENDING
                ) {
                    item.copy(
                        state = MobileQueueState.BLOCKED,
                        lastError = "Blocked by earlier failed action ${current.endpoint}.",
                        updatedAtEpochMs = now,
                    )
                } else {
                    item
                }
            }
            items.clear()
            items.addAll(blocked)
        }
    }

    fun pruneSynced(maxAgeMs: Long) {
        val threshold = nowEpochMs() - maxAgeMs
        items.removeAll { it.state == MobileQueueState.SYNCED && it.updatedAtEpochMs < threshold }
    }

    private fun replace(item: MobileQueueItem) {
        val index = items.indexOfFirst { it.id == item.id }
        if (index >= 0) items[index] = item
    }

    private fun validateStoredItem(item: MobileQueueItem): Boolean {
        if (item.ownerUserId.isBlank() || item.driverId.isBlank() || item.jobId.isBlank() || item.mutationKey.isBlank()) return false
        if (!MobileLifecycleCommand.isValid(item.command)) return false
        val expectedFingerprint = fingerprint(
            ownerUserId = item.ownerUserId,
            driverId = item.driverId,
            jobId = item.jobId,
            command = item.command,
            mutationKey = item.mutationKey,
        )
        return item.payloadFingerprint == expectedFingerprint
    }

    private fun fingerprint(
        ownerUserId: String,
        driverId: String,
        jobId: String,
        command: MobileLifecycleCommand,
        mutationKey: String,
    ): String {
        val commandFields = command.fingerprintFields() ?: error("Queue command fingerprint is invalid.")
        val canonicalPayload = (listOf(
            ownerUserId.trim(),
            driverId.trim(),
            jobId.trim(),
            mutationKey.trim(),
        ) + commandFields).joinToString("|")
        val bytes = MessageDigest.getInstance("SHA-256").digest(canonicalPayload.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
