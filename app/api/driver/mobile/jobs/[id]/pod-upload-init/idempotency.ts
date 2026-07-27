export interface UploadLedgerEntry {
  evidenceId: string;
  podKey: string;
  payloadFingerprint: string;
  path: string;
  sha256Hex: string;
  byteSize: number;
  mimeType: string;
  kind: string;
  issuedAt: string;
}

/** Stable metadata fields used for idempotency comparison. */
export interface UploadInitRequest {
  evidenceId: string;
  podKey: string;
  sha256Hex: string;
  byteSize: number;
  mimeType: string;
  kind: string;
}

export type PodUploadInitIdempotency =
  | { status: 'new' }
  | { status: 'match'; existingEntry: UploadLedgerEntry }
  | { status: 'conflict' };

/**
 * Determines whether an upload-init request is new, an idempotent retry for an
 * existing ledger entry, or a conflict (same evidenceId, different stable metadata).
 *
 * The stable identity fields are: evidenceId, podKey, sha256Hex, byteSize,
 * mimeType, and kind. The reconstructed file name is intentionally excluded so
 * that a retry after process death does not need to reproduce the original name.
 */
export function podUploadInitIdempotencyCheck(
  existingLedger: UploadLedgerEntry[],
  req: UploadInitRequest,
): PodUploadInitIdempotency {
  const existingEntry = existingLedger.find((e) => e.evidenceId === req.evidenceId);
  if (!existingEntry) return { status: 'new' };

  if (
    existingEntry.podKey === req.podKey &&
    existingEntry.sha256Hex === req.sha256Hex &&
    existingEntry.byteSize === req.byteSize &&
    existingEntry.mimeType === req.mimeType &&
    existingEntry.kind === req.kind
  ) {
    return { status: 'match', existingEntry };
  }

  return { status: 'conflict' };
}
