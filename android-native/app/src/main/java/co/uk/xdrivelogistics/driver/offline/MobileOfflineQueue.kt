package co.uk.xdrivelogistics.driver.offline

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
    val jobId: String,
    val endpoint: String,
    val payloadJson: String,
    val dedupeKey: String,
    val sequence: Long,
    val state: MobileQueueState = MobileQueueState.PENDING,
    val attempts: Int = 0,
    val lastError: String = "",
    val leaseExpiresAtEpochMs: Long? = null,
    val updatedAtEpochMs: Long,
)

class MobileOfflineQueue(private val nowEpochMs: () -> Long = { System.currentTimeMillis() }) {
    private var nextSequence = 1L
    private val items = mutableListOf<MobileQueueItem>()

    fun restore(restored: List<MobileQueueItem>) {
        items.clear()
        items.addAll(
            restored
                .filter { MobileMutationEndpoint.fromPath(it.endpoint) != null }
                .sortedBy { it.sequence }
        )
        nextSequence = (items.maxOfOrNull { it.sequence } ?: 0L) + 1L
    }

    fun snapshot(): List<MobileQueueItem> = items.sortedBy { it.sequence }

    fun enqueue(
        ownerUserId: String,
        jobId: String,
        endpoint: String,
        payloadJson: String,
        dedupeKey: String,
    ): MobileQueueItem {
        require(ownerUserId.isNotBlank()) { "Queue owner is required." }
        require(jobId.isNotBlank()) { "Queue job id is required." }
        require(payloadJson.isNotBlank()) { "Queue payload is required." }
        require(MobileMutationEndpoint.fromPath(endpoint) != null) { "Queue endpoint is not allowed." }

        val duplicate = items.firstOrNull {
            it.ownerUserId == ownerUserId &&
                it.state in setOf(MobileQueueState.PENDING, MobileQueueState.SYNCING) &&
                it.dedupeKey == dedupeKey
        }
        if (duplicate != null) return duplicate

        val item = MobileQueueItem(
            id = "${ownerUserId.take(12)}-${nextSequence}",
            ownerUserId = ownerUserId,
            jobId = jobId,
            endpoint = endpoint,
            payloadJson = payloadJson,
            dedupeKey = dedupeKey,
            sequence = nextSequence++,
            updatedAtEpochMs = nowEpochMs(),
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
}
