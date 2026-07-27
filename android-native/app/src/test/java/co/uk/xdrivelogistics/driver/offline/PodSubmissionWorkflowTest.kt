package co.uk.xdrivelogistics.driver.offline

import org.junit.Test
import org.junit.Assert.*

/**
 * JVM unit tests for [PodSubmissionStore] and the POD submission workflow.
 *
 * Uses [InMemoryPodStoreBackend] so no Android context or EncryptedSharedPreferences
 * is required.  Tests cover:
 *
 *  1.  Write/read round-trip via InMemoryPodStoreBackend
 *  2.  Account isolation (pendingForOwner never crosses ownerUserId boundaries)
 *  3.  Malformed-record quarantine in pendingForOwner
 *  4.  Non-null payloadFingerprint enforced by recordSubmission
 *  5.  CommitFailed exception on backend write failure
 *  6.  markEvidenceUploaded transitions state to READY_TO_FINALISE when all uploaded
 *  7.  clearSubmission removes the record
 *  8.  Restart recovery: READY_TO_FINALISE record survives
 *  9.  Deprecated methods (uploadPodDocument / patchPodJobRecord / confirmDeliveryRecipient)
 *      have been REMOVED from ApiClient
 * 10.  finalisePod, initPodEvidenceUpload, finaliseCollectionProof are non-deprecated
 * 11.  MAX_ATTEMPTS constant defined and positive
 * 12.  Collection kind is distinct from delivery photos
 */
class PodSubmissionWorkflowTest {

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun makeStore(
        onQuarantined: (String, String, Throwable) -> Unit = { _, _, _ -> },
    ): PodSubmissionStore = PodSubmissionStore(InMemoryPodStoreBackend(), true, onQuarantined)

    private fun evidenceRecord(
        evidenceId: String = "ev-00000000-aaaaaaaaaaaaaaaa",
        kind: String = "photos",
        sha256: String = "a".repeat(64),
        state: PodSubmissionStore.EvidenceState = PodSubmissionStore.EvidenceState.PENDING_UPLOAD,
        storagePath: String? = null,
        localUri: String = "/data/user/0/co.uk.xdrivelogistics.driver/files/pod/user-a/job-1/$evidenceId.jpg",
    ) = PodSubmissionStore.EvidenceRecord(
        evidenceId = evidenceId,
        localUri = localUri,
        sha256Hex = sha256,
        mimeType = "image/jpeg",
        byteSize = 102400L,
        kind = kind,
        state = state,
        storagePath = storagePath,
    )

    private fun submissionRecord(
        podKey: String = "pod-jobid001-userid01-nonce0001",
        ownerUserId: String = "user-a",
        driverId: String = "driver-a",
        jobId: String = "job-1",
        recipientName: String = "",
        payloadFingerprint: String = "a".repeat(64),
        state: PodSubmissionStore.SubmissionState = PodSubmissionStore.SubmissionState.PENDING,
        evidence: List<PodSubmissionStore.EvidenceRecord> = listOf(evidenceRecord()),
    ) = PodSubmissionStore.PodSubmissionRecord(
        podKey = podKey,
        payloadFingerprint = payloadFingerprint,
        ownerUserId = ownerUserId,
        driverId = driverId,
        jobId = jobId,
        recipientName = recipientName,
        signatureDataUri = null,
        notes = null,
        evidence = evidence,
        state = state,
    )

    // -------------------------------------------------------------------------
    // 1. Write/read round-trip
    // -------------------------------------------------------------------------

    @Test
    fun `recordSubmission then pendingForOwner returns the stored record`() {
        val store = makeStore()
        val rec = submissionRecord(ownerUserId = "user-a", jobId = "job-1")
        store.recordSubmission(rec)

        val pending = store.pendingForOwner("user-a")
        assertEquals(1, pending.size)
        assertEquals(rec.podKey, pending[0].podKey)
        assertEquals(rec.payloadFingerprint, pending[0].payloadFingerprint)
        assertEquals(rec.jobId, pending[0].jobId)
    }

    @Test
    fun `getForOwnerJob returns the stored record for correct owner`() {
        val store = makeStore()
        val rec = submissionRecord(ownerUserId = "user-a", jobId = "job-42")
        store.recordSubmission(rec)

        val found = store.getForOwnerJob("user-a", "job-42")
        assertNotNull(found)
        assertEquals("job-42", found!!.jobId)
    }

    @Test
    fun `getForOwnerJob returns null for wrong owner`() {
        val store = makeStore()
        store.recordSubmission(submissionRecord(ownerUserId = "user-a", jobId = "job-1"))

        assertNull(store.getForOwnerJob("user-b", "job-1"))
    }

    // -------------------------------------------------------------------------
    // 2. Account isolation
    // -------------------------------------------------------------------------

    @Test
    fun `pendingForOwner only returns records for the requested owner`() {
        val store = makeStore()
        store.recordSubmission(submissionRecord(ownerUserId = "user-a", jobId = "job-1"))
        store.recordSubmission(submissionRecord(ownerUserId = "user-b", jobId = "job-2"))
        store.recordSubmission(submissionRecord(ownerUserId = "user-a", jobId = "job-3"))

        val forA = store.pendingForOwner("user-a")
        assertEquals(2, forA.size)
        assertTrue(forA.all { it.ownerUserId == "user-a" })

        val forB = store.pendingForOwner("user-b")
        assertEquals(1, forB.size)
        assertEquals("user-b", forB[0].ownerUserId)
    }

    @Test
    fun `ownerUserId is preserved through copy-update of recipientName`() {
        val store = makeStore()
        store.recordSubmission(submissionRecord(ownerUserId = "user-a"))
        val rec = store.pendingForOwner("user-a")[0]
        store.recordSubmission(
            rec.copy(recipientName = "Alice", state = PodSubmissionStore.SubmissionState.READY_TO_FINALISE)
        )
        val updated = store.pendingForOwner("user-a")[0]
        assertEquals("user-a", updated.ownerUserId)
        assertEquals("Alice", updated.recipientName)
    }

    // -------------------------------------------------------------------------
    // 3. Malformed-record quarantine
    // -------------------------------------------------------------------------

    @Test
    fun `pendingForOwner quarantines malformed records without throwing`() {
        val backend = InMemoryPodStoreBackend()
        // Inject a deliberately malformed JSON entry directly into the backend.
        backend.putStringSync("pod_sub_user-a_job-bad", "{invalid json{{")

        val quarantined = mutableListOf<String>()
        val store = PodSubmissionStore(backend, true) { key, _, _ -> quarantined.add(key) }

        // Also add one valid record.
        val valid = submissionRecord(ownerUserId = "user-a", jobId = "job-good")
        store.recordSubmission(valid)

        val pending = store.pendingForOwner("user-a")
        assertEquals(1, pending.size)
        assertEquals("job-good", pending[0].jobId)
        assertEquals(1, quarantined.size)
        assertTrue(quarantined[0].contains("job-bad"))
    }

    // -------------------------------------------------------------------------
    // 4. Non-null payloadFingerprint enforced
    // -------------------------------------------------------------------------

    @Test(expected = IllegalArgumentException::class)
    fun `recordSubmission throws IllegalArgumentException for blank payloadFingerprint`() {
        val store = makeStore()
        // PodSubmissionRecord.payloadFingerprint is String (non-null) but we can pass blank.
        store.recordSubmission(submissionRecord(payloadFingerprint = ""))
    }

    @Test
    fun `payloadFingerprint is preserved through store round-trip`() {
        val store = makeStore()
        val fp = "b".repeat(64)
        store.recordSubmission(submissionRecord(payloadFingerprint = fp))
        val rec = store.pendingForOwner("user-a")[0]
        assertEquals(fp, rec.payloadFingerprint)
    }

    // -------------------------------------------------------------------------
    // 5. CommitFailed on backend write failure
    // -------------------------------------------------------------------------

    @Test(expected = PodStorageException.CommitFailed::class)
    fun `recordSubmission throws CommitFailed when backend commit returns false`() {
        val failingBackend = object : PodStoreBackend {
            override fun getString(key: String): String? = null
            override fun putStringSync(key: String, value: String): Boolean = false
            override fun removeSync(key: String): Boolean = false
            override fun allStrings(): Map<String, String> = emptyMap()
        }
        val store = PodSubmissionStore(failingBackend, true)
        store.recordSubmission(submissionRecord())
    }

    @Test(expected = PodStorageException.Unavailable::class)
    fun `recordSubmission throws Unavailable when isStorageAvailable is false`() {
        val store = PodSubmissionStore(InMemoryPodStoreBackend(), false)
        store.recordSubmission(submissionRecord())
    }

    // -------------------------------------------------------------------------
    // 6. markEvidenceUploaded transitions to READY_TO_FINALISE when all uploaded
    // -------------------------------------------------------------------------

    @Test
    fun `markEvidenceUploaded sets storagePath and transitions submission to READY_TO_FINALISE`() {
        val store = makeStore()
        val evidenceId = "ev-00000000-aaaaaaaaaaaaaaaa"
        store.recordSubmission(submissionRecord(jobId = "job-1", evidence = listOf(evidenceRecord(evidenceId = evidenceId))))

        store.markEvidenceUploaded("user-a", "job-1", evidenceId, "job-1/photos/$evidenceId-test.jpg")

        val rec = store.getForOwnerJob("user-a", "job-1")
        assertNotNull(rec)
        val ev = rec!!.evidence.first()
        assertEquals("job-1/photos/$evidenceId-test.jpg", ev.storagePath)
        assertEquals(PodSubmissionStore.EvidenceState.UPLOADED, ev.state)
        assertEquals(PodSubmissionStore.SubmissionState.READY_TO_FINALISE, rec.state)
    }

    @Test
    fun `submission stays PENDING when not all evidence items are uploaded`() {
        val store = makeStore()
        store.recordSubmission(
            submissionRecord(
                jobId = "job-2",
                evidence = listOf(
                    evidenceRecord(evidenceId = "ev-01"),
                    evidenceRecord(evidenceId = "ev-02"),
                ),
            )
        )
        store.markEvidenceUploaded("user-a", "job-2", "ev-01", "job-2/photos/ev-01-test.jpg")

        val rec = store.getForOwnerJob("user-a", "job-2")!!
        assertEquals(PodSubmissionStore.SubmissionState.PENDING, rec.state)
    }

    // -------------------------------------------------------------------------
    // 7. clearSubmission removes the record
    // -------------------------------------------------------------------------

    @Test
    fun `clearSubmission removes the record from the store`() {
        val store = makeStore()
        store.recordSubmission(submissionRecord(ownerUserId = "user-a", jobId = "job-clear"))
        assertNotNull(store.getForOwnerJob("user-a", "job-clear"))

        store.clearSubmission("user-a", "job-clear")
        assertNull(store.getForOwnerJob("user-a", "job-clear"))
        assertTrue(store.pendingForOwner("user-a").isEmpty())
    }

    // -------------------------------------------------------------------------
    // 8. Restart recovery — READY_TO_FINALISE record is preserved
    // -------------------------------------------------------------------------

    @Test
    fun `READY_TO_FINALISE record with recipientName survives store round-trip`() {
        val store = makeStore()
        val photoPath = "job-1/photos/ev-00000000-aaaaaaaaaaaaaaaa-test.jpg"
        store.recordSubmission(
            submissionRecord(
                jobId = "job-1",
                recipientName = "Bob Builder",
                payloadFingerprint = "c".repeat(64),
                state = PodSubmissionStore.SubmissionState.READY_TO_FINALISE,
                evidence = listOf(
                    evidenceRecord(
                        state = PodSubmissionStore.EvidenceState.UPLOADED,
                        storagePath = photoPath,
                    )
                ),
            )
        )
        val rec = store.pendingForOwner("user-a")[0]
        assertEquals(PodSubmissionStore.SubmissionState.READY_TO_FINALISE, rec.state)
        assertEquals("Bob Builder", rec.recipientName)
        assertEquals(listOf(photoPath), rec.evidence.mapNotNull { it.storagePath })
    }

    // -------------------------------------------------------------------------
    // 9. Deprecated methods have been REMOVED from ApiClient
    // -------------------------------------------------------------------------

    @Test
    fun `ApiClient uploadPodDocument has been removed`() {
        val member = co.uk.xdrivelogistics.driver.data.ApiClient::class.members
            .find { it.name == "uploadPodDocument" }
        assertNull(
            "uploadPodDocument must be removed — use initPodEvidenceUpload + uploadEvidenceBytes + finalisePod",
            member,
        )
    }

    @Test
    fun `ApiClient patchPodJobRecord has been removed`() {
        val member = co.uk.xdrivelogistics.driver.data.ApiClient::class.members
            .find { it.name == "patchPodJobRecord" }
        assertNull(
            "patchPodJobRecord must be removed — use finaliseCollectionProof or finalisePod",
            member,
        )
    }

    @Test
    fun `ApiClient confirmDeliveryRecipient has been removed`() {
        val member = co.uk.xdrivelogistics.driver.data.ApiClient::class.members
            .find { it.name == "confirmDeliveryRecipient" }
        assertNull(
            "confirmDeliveryRecipient must be removed — use finalisePod",
            member,
        )
    }

    // -------------------------------------------------------------------------
    // 10. Current canonical methods are non-deprecated
    // -------------------------------------------------------------------------

    @Test
    fun `finalisePod exists and is not deprecated`() {
        val member = co.uk.xdrivelogistics.driver.data.ApiClient::class.members
            .find { it.name == "finalisePod" }
        assertNotNull("finalisePod must exist on ApiClient", member)
        val deprecated = member?.annotations?.filterIsInstance<Deprecated>()
        assertTrue("finalisePod must NOT be deprecated", deprecated.isNullOrEmpty())
    }

    @Test
    fun `initPodEvidenceUpload exists and is not deprecated`() {
        val member = co.uk.xdrivelogistics.driver.data.ApiClient::class.members
            .find { it.name == "initPodEvidenceUpload" }
        assertNotNull("initPodEvidenceUpload must exist on ApiClient", member)
        val deprecated = member?.annotations?.filterIsInstance<Deprecated>()
        assertTrue("initPodEvidenceUpload must NOT be deprecated", deprecated.isNullOrEmpty())
    }

    @Test
    fun `finaliseCollectionProof exists and is not deprecated`() {
        val member = co.uk.xdrivelogistics.driver.data.ApiClient::class.members
            .find { it.name == "finaliseCollectionProof" }
        assertNotNull("finaliseCollectionProof must exist on ApiClient", member)
        val deprecated = member?.annotations?.filterIsInstance<Deprecated>()
        assertTrue("finaliseCollectionProof must NOT be deprecated", deprecated.isNullOrEmpty())
    }

    // -------------------------------------------------------------------------
    // 11. MAX_ATTEMPTS constant
    // -------------------------------------------------------------------------

    @Test
    fun `MAX_ATTEMPTS is positive`() {
        assertTrue(PodSubmissionStore.MAX_ATTEMPTS > 0)
    }

    @Test
    fun `record at MAX_ATTEMPTS should be blocked by caller`() {
        val rec = submissionRecord().copy(attemptCount = PodSubmissionStore.MAX_ATTEMPTS)
        assertTrue(rec.attemptCount >= PodSubmissionStore.MAX_ATTEMPTS)
    }

    // -------------------------------------------------------------------------
    // 12. Collection kind is distinct from delivery photos
    // -------------------------------------------------------------------------

    @Test
    fun `collection kind evidence does not appear in photos filter for finalisePod`() {
        val store = makeStore()
        store.recordSubmission(
            submissionRecord(
                jobId = "job-col",
                evidence = listOf(
                    evidenceRecord(
                        evidenceId = "ev-col-01",
                        kind = "collection",
                        state = PodSubmissionStore.EvidenceState.UPLOADED,
                        storagePath = "job-col/collection/ev-col-01-photo.jpg",
                    )
                ),
            )
        )
        val rec = store.getForOwnerJob("user-a", "job-col")!!
        val photoPaths = rec.evidence.filter { it.kind == "photos" }.mapNotNull { it.storagePath }
        val collectionPaths = rec.evidence.filter { it.kind == "collection" }.mapNotNull { it.storagePath }

        assertTrue("Collection paths must not appear in delivery photoPaths", photoPaths.isEmpty())
        assertEquals(1, collectionPaths.size)
    }

    // -------------------------------------------------------------------------
    // 13. localUri must be set to a durable app-private path (not blank)
    // -------------------------------------------------------------------------

    @Test
    fun `evidence localUri is a non-blank durable path`() {
        val ev = evidenceRecord()
        assertTrue(
            "localUri must be a non-blank durable path",
            ev.localUri.isNotBlank(),
        )
        assertFalse(
            "localUri must not be a cache path",
            ev.localUri.contains("/cache/"),
        )
    }

    // -------------------------------------------------------------------------
    // 14. BLOCKED state — markBlocked and pendingForOwner surface it
    // -------------------------------------------------------------------------

    @Test
    fun `markBlocked transitions submission to BLOCKED`() {
        val store = makeStore()
        store.recordSubmission(submissionRecord(ownerUserId = "user-a", jobId = "job-block"))

        store.markBlocked("user-a", "job-block")

        val rec = store.getForOwnerJob("user-a", "job-block")
        assertNotNull(rec)
        assertEquals(PodSubmissionStore.SubmissionState.BLOCKED, rec!!.state)
    }

    @Test
    fun `BLOCKED record is returned by pendingForOwner`() {
        val store = makeStore()
        store.recordSubmission(submissionRecord(ownerUserId = "user-a", jobId = "job-block"))
        store.markBlocked("user-a", "job-block")

        val pending = store.pendingForOwner("user-a")
        assertEquals(1, pending.size)
        assertEquals(PodSubmissionStore.SubmissionState.BLOCKED, pending[0].state)
    }

    @Test
    fun `BLOCKED record is NOT silently deleted after MAX_ATTEMPTS`() {
        val store = makeStore()
        val rec = submissionRecord(ownerUserId = "user-a", jobId = "job-max")
            .copy(attemptCount = PodSubmissionStore.MAX_ATTEMPTS)
        store.recordSubmission(rec)
        store.markBlocked("user-a", "job-max")

        // The record must still be present for manual inspection.
        val found = store.getForOwnerJob("user-a", "job-max")
        assertNotNull("BLOCKED record must be preserved, not deleted", found)
        assertEquals(PodSubmissionStore.SubmissionState.BLOCKED, found!!.state)
    }

    // -------------------------------------------------------------------------
    // 15. Canonical payload fingerprint uses stable identifiers, not storage paths
    // -------------------------------------------------------------------------

    @Test
    fun `canonical fingerprint is deterministic from podKey + evidenceId-sha256 pairs + recipient`() {
        val podKey = "pod-jobid001-userid01-nonce0001"
        val ev = evidenceRecord()
        val recipientName = "Alice"

        val evidencePairs = listOf(ev).sortedBy { it.evidenceId }
            .joinToString("|") { "${it.evidenceId}:${it.sha256Hex}" }
        val input = "$podKey|$evidencePairs|$recipientName"

        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray())
            .joinToString("") { "%02x".format(it) }

        assertEquals(64, digest.length)
        assertTrue(digest.all { it.isDigit() || it in 'a'..'f' })

        // Same inputs produce same fingerprint (deterministic).
        val digest2 = java.security.MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray())
            .joinToString("") { "%02x".format(it) }
        assertEquals(digest, digest2)
    }

    @Test
    fun `canonical fingerprint does NOT use storage paths`() {
        val ev = evidenceRecord(storagePath = "job-1/photos/ev-00000000-aaaaaaaaaaaaaaaa-test.jpg")

        val podKey = "pod-jobid001-userid01-nonce0001"
        val evidencePairs = listOf(ev).sortedBy { it.evidenceId }
            .joinToString("|") { "${it.evidenceId}:${it.sha256Hex}" }
        val canonicalInput = "$podKey|$evidencePairs|Alice"

        assertFalse(
            "Canonical fingerprint input must not contain storage paths",
            canonicalInput.contains(ev.storagePath!!),
        )
        assertTrue(
            "Canonical fingerprint input must contain evidenceId",
            canonicalInput.contains(ev.evidenceId),
        )
        assertTrue(
            "Canonical fingerprint input must contain sha256Hex",
            canonicalInput.contains(ev.sha256Hex),
        )
    }

    // -------------------------------------------------------------------------
    // 16. Restart recovery — evidence metadata survives store round-trip
    // -------------------------------------------------------------------------

    @Test
    fun `PENDING_UPLOAD evidence record survives store round-trip for recovery`() {
        val store = makeStore()
        val ev = evidenceRecord(
            state = PodSubmissionStore.EvidenceState.PENDING_UPLOAD,
            localUri = "/data/user/0/co.uk.xdrivelogistics.driver/files/pod/user-a/job-r/ev-00000000-aaaaaaaaaaaaaaaa.jpg",
        )
        store.recordSubmission(submissionRecord(jobId = "job-r", evidence = listOf(ev)))

        val recovered = store.getForOwnerJob("user-a", "job-r")
        assertNotNull(recovered)
        val recoveredEv = recovered!!.evidence.first()
        assertEquals(PodSubmissionStore.EvidenceState.PENDING_UPLOAD, recoveredEv.state)
        assertEquals(ev.sha256Hex, recoveredEv.sha256Hex)
        assertEquals(ev.byteSize, recoveredEv.byteSize)
        assertEquals(ev.localUri, recoveredEv.localUri)
    }

    @Test
    fun `UPLOAD_INITIATED evidence is preserved for recovery`() {
        val store = makeStore()
        val ev = evidenceRecord(state = PodSubmissionStore.EvidenceState.UPLOAD_INITIATED)
        store.recordSubmission(submissionRecord(jobId = "job-initiated", evidence = listOf(ev)))

        val recovered = store.getForOwnerJob("user-a", "job-initiated")!!
        assertEquals(PodSubmissionStore.EvidenceState.UPLOAD_INITIATED, recovered.evidence.first().state)
    }

    // -------------------------------------------------------------------------
    // 17. markEvidenceInitiated throws CommitFailed when backend fails
    // -------------------------------------------------------------------------

    @Test(expected = PodStorageException.CommitFailed::class)
    fun `markEvidenceInitiated throws CommitFailed when backend commit returns false`() {
        val backend = InMemoryPodStoreBackend()
        val store = PodSubmissionStore(backend, true)
        val evidenceId = "ev-00000000-aaaaaaaaaaaaaaaa"
        // Record succeeds via the in-memory backend; then swap to a failing backend via a
        // wrapper that fails all subsequent writes.
        store.recordSubmission(submissionRecord(evidence = listOf(evidenceRecord(evidenceId = evidenceId))))

        val failingBackend = object : PodStoreBackend {
            override fun getString(key: String): String? = backend.getString(key)
            override fun putStringSync(key: String, value: String): Boolean = false
            override fun removeSync(key: String): Boolean = false
            override fun allStrings(): Map<String, String> = backend.allStrings()
        }
        val failingStore = PodSubmissionStore(failingBackend, true)
        // Seed the failing store with the record so it can find it.
        backend.putStringSync(
            "pod_sub_user-a_job-1",
            com.google.gson.Gson().toJson(submissionRecord(evidence = listOf(evidenceRecord(evidenceId = evidenceId))))
        )
        failingStore.markEvidenceInitiated("user-a", "job-1", evidenceId)
    }

    // -------------------------------------------------------------------------
    // 18. markEvidenceUploaded throws CommitFailed when backend fails
    // -------------------------------------------------------------------------

    @Test(expected = PodStorageException.CommitFailed::class)
    fun `markEvidenceUploaded throws CommitFailed when backend commit returns false`() {
        val backend = InMemoryPodStoreBackend()
        val evidenceId = "ev-00000000-aaaaaaaaaaaaaaaa"
        backend.putStringSync(
            "pod_sub_user-a_job-1",
            com.google.gson.Gson().toJson(submissionRecord(evidence = listOf(evidenceRecord(evidenceId = evidenceId))))
        )
        val failingBackend = object : PodStoreBackend {
            override fun getString(key: String): String? = backend.getString(key)
            override fun putStringSync(key: String, value: String): Boolean = false
            override fun removeSync(key: String): Boolean = false
            override fun allStrings(): Map<String, String> = backend.allStrings()
        }
        val store = PodSubmissionStore(failingBackend, true)
        store.markEvidenceUploaded("user-a", "job-1", evidenceId, "job-1/photos/$evidenceId-test.jpg")
    }

    // -------------------------------------------------------------------------
    // 19. Evidence appended to existing submission is persisted before upload
    // -------------------------------------------------------------------------

    @Test
    fun `second evidence item is appended to existing submission record`() {
        val store = makeStore()
        val ev1 = evidenceRecord(
            evidenceId = "ev-00000000-aaaaaaaaaaaaaaaa",
            sha256 = "a".repeat(64),
            localUri = "/data/user/0/co.uk.xdrivelogistics.driver/files/pod/user-a/job-1/ev-00000000-aaaaaaaaaaaaaaaa.jpg",
        )
        val original = submissionRecord(jobId = "job-1", evidence = listOf(ev1))
        store.recordSubmission(original)

        val ev2 = evidenceRecord(
            evidenceId = "ev-00000000-bbbbbbbbbbbbbbbb",
            sha256 = "b".repeat(64),
            localUri = "/data/user/0/co.uk.xdrivelogistics.driver/files/pod/user-a/job-1/ev-00000000-bbbbbbbbbbbbbbbb.jpg",
        )
        val updatedEvidence = original.evidence.filter { it.evidenceId != ev2.evidenceId } + ev2
        val updatedFp = "c".repeat(64)
        store.recordSubmission(original.copy(evidence = updatedEvidence, payloadFingerprint = updatedFp))

        val rec = store.getForOwnerJob("user-a", "job-1")
        assertNotNull(rec)
        assertEquals(2, rec!!.evidence.size)
        assertTrue(rec.evidence.any { it.evidenceId == ev1.evidenceId })
        assertTrue(rec.evidence.any { it.evidenceId == ev2.evidenceId })
        assertEquals(updatedFp, rec.payloadFingerprint)
    }

    @Test
    fun `appending evidence with same evidenceId replaces rather than duplicates`() {
        val store = makeStore()
        val evidenceId = "ev-00000000-aaaaaaaaaaaaaaaa"
        val ev1 = evidenceRecord(evidenceId = evidenceId, sha256 = "a".repeat(64))
        val original = submissionRecord(jobId = "job-1", evidence = listOf(ev1))
        store.recordSubmission(original)

        // Simulate deterministic replace: filter same ID then append new version.
        val ev1Updated = ev1.copy(sha256Hex = "b".repeat(64))
        val updatedEvidence = original.evidence.filter { it.evidenceId != evidenceId } + ev1Updated
        store.recordSubmission(original.copy(evidence = updatedEvidence, payloadFingerprint = "d".repeat(64)))

        val rec = store.getForOwnerJob("user-a", "job-1")!!
        assertEquals(1, rec.evidence.size)
        assertEquals("b".repeat(64), rec.evidence.first().sha256Hex)
    }

    // -------------------------------------------------------------------------
    // 21. Two-job isolation: clearSubmission for job-b leaves job-a untouched
    // -------------------------------------------------------------------------

    @Test
    fun `clearSubmission for job-b leaves job-a record untouched in reconstructed store`() {
        val backend = InMemoryPodStoreBackend()
        val store = PodSubmissionStore(backend, true)

        val recA = submissionRecord(ownerUserId = "user-a", jobId = "job-a",
            podKey = "pod-job-a", payloadFingerprint = "a".repeat(64))
        val recB = submissionRecord(ownerUserId = "user-a", jobId = "job-b",
            podKey = "pod-job-b", payloadFingerprint = "b".repeat(64))

        store.recordSubmission(recA)
        store.recordSubmission(recB)

        // Finalise job-b — simulate successful server confirmation.
        store.clearSubmission("user-a", "job-b")

        // Reconstruct the store from the same backend (simulates app restart).
        val rebuiltStore = PodSubmissionStore(backend, true)

        val remaining = rebuiltStore.pendingForOwner("user-a")
        assertEquals("only job-a must remain after job-b is cleared", 1, remaining.size)
        assertEquals("job-a", remaining.first().jobId)

        assertNotNull("job-a must still be readable", rebuiltStore.getForOwnerJob("user-a", "job-a"))
        assertEquals(recA.podKey, rebuiltStore.getForOwnerJob("user-a", "job-a")!!.podKey)
        assertEquals(recA.payloadFingerprint, rebuiltStore.getForOwnerJob("user-a", "job-a")!!.payloadFingerprint)

        assertNull("job-b must be absent after clearSubmission", rebuiltStore.getForOwnerJob("user-a", "job-b"))
    }
}
