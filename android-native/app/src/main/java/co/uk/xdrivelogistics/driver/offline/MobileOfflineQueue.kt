package co.uk.xdrivelogistics.driver.offline

import java.security.MessageDigest

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
        get() = command.action.endpointPath
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
    val action: MobileLifecycleAction,
    val targetStatus: String,
) {
    companion object {
        fun create(action: MobileLifecycleAction, targetStatus: String): MobileLifecycleCommand {
            require(action.targetStatus == targetStatus) { "Queue lifecycle command is not allowed." }
            return MobileLifecycleCommand(
                action = action,
                targetStatus = targetStatus,
            )
        }

        fun fromEndpointAndStatus(endpoint: String, targetStatus: String): MobileLifecycleCommand? {
            val action = MobileLifecycleAction.fromEndpoint(endpoint) ?: return null
            return runCatching { create(action, targetStatus) }.getOrNull()
        }

        fun isValid(command: MobileLifecycleCommand?): Boolean {
            if (command == null) return false
            return command.action.targetStatus == command.targetStatus
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
        require(MobileLifecycleCommand.isValid(command)) { "Queue lifecycle payload is invalid." }

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
        val canonicalPayload = listOf(
            ownerUserId.trim(),
            driverId.trim(),
            jobId.trim(),
            command.action.name,
            command.targetStatus.trim(),
            mutationKey.trim(),
        ).joinToString("|")
        val bytes = MessageDigest.getInstance("SHA-256").digest(canonicalPayload.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
