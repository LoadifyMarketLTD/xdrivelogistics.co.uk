import { Buffer } from 'node:buffer';
import { PDFDocument } from 'pdf-lib';

const LIMIT = 10 * 1024 * 1024;
/** Validates server-frozen attachments without rewriting a previously approved snapshot. */
export async function validateInvoiceAttachmentSnapshot(value: unknown, hasJob: boolean, previouslyFrozen: boolean): Promise<string | null> {
  if (!Array.isArray(value)) return 'Invoice PDF attachments are missing.';
  const legacyCombined = hasJob && previouslyFrozen && value.length === 1;
  if (value.length !== (hasJob && !legacyCombined ? 2 : 1)) return 'Separate invoice and POD PDF attachments are required.';
  const counts: number[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.content !== 'string' || typeof item.filename !== 'string' || !/\.pdf$/i.test(item.filename)) return 'The frozen PDF attachment is invalid.';
    if (item.content.length > Math.ceil(LIMIT / 3) * 4 + 4) return 'The frozen PDF attachment exceeds the allowed size.';
    const bytes = Buffer.from(item.content, 'base64');
    if (!bytes.length || bytes.length > LIMIT) return 'The frozen PDF attachment exceeds the allowed size or is empty.';
    const pdf = await PDFDocument.load(bytes).catch(() => null);
    if (!pdf) return 'The frozen PDF attachment is invalid.';
    counts.push(pdf.getPageCount());
  }
  if (legacyCombined) return counts[0] >= 2 ? null : 'Historical combined invoice and POD attachment is incomplete.';
  if (counts[0] !== 1) return 'The frozen invoice PDF is invalid.';
  if (hasJob && counts[1] < 2) return 'Signed POD attachment is incomplete.';
  return null;
}
