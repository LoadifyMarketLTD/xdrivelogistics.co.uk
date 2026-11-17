import { describe, expect, it } from 'vitest';
import { issueCrmCsvPreviewToken, verifyCrmCsvPreviewToken } from '../lib/business-development/csvPreviewToken';

const sha = 'a'.repeat(64);
const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const secret = 'isolated-testing-only-secret-key-32-bytes';
const now = 1763360000;

describe('CRM CSV import requires a signed and current owner review', () => {
  const preview = () => issueCrmCsvPreviewToken(sha, owner, secret, now);
  it('accepts a signed preview for the same owner/file within 15 minutes', () => {
    const token = preview();
    expect(token).toBeTruthy();
    expect(verifyCrmCsvPreviewToken(token, sha, owner, secret, now + 899)).toBe(true);
    expect(verifyCrmCsvPreviewToken(token, sha, owner, secret, now + 900)).toBe(true);
  });
  it('denies changed data and mismatched owner', () => {
    const token = preview();
    expect(verifyCrmCsvPreviewToken(token, 'b'.repeat(64), owner, secret, now)).toBe(false);
    expect(verifyCrmCsvPreviewToken(token, sha, otherOwner, secret, now)).toBe(false);
  });
  it('denies expired, far-future or modified signatures', () => {
    const token = preview()!;
    expect(verifyCrmCsvPreviewToken(token, sha, owner, secret, now + 901)).toBe(false);
    expect(verifyCrmCsvPreviewToken(token, sha, owner, secret, now - 61)).toBe(false);
    expect(verifyCrmCsvPreviewToken(token.slice(0, -1) + '0', sha, owner, secret, now)).toBe(false);
  });
  it('fails closed without a dedicated strong signing secret', () => {
    expect(issueCrmCsvPreviewToken(sha, owner, '', now)).toBeNull();
    expect(issueCrmCsvPreviewToken(sha, owner, 'weak', now)).toBeNull();
    expect(verifyCrmCsvPreviewToken(preview(), sha, owner, 'weak', now)).toBe(false);
    expect(verifyCrmCsvPreviewToken(preview(), sha, owner, undefined, now)).toBe(false);
  });
  it('denies fabricated hashes, malformed previews and random inputs', () => {
    expect(issueCrmCsvPreviewToken('bad', owner, secret, now)).toBeNull();
    expect(verifyCrmCsvPreviewToken('v1.invalid.' + owner, sha, owner, secret, now)).toBe(false);
    expect(verifyCrmCsvPreviewToken(null, sha, owner, secret, now)).toBe(false);
    expect(verifyCrmCsvPreviewToken('', sha, owner, secret, now)).toBe(false);
  });
  it('does not expose the signing secret in the issued token', () => {
    expect(preview()).not.toContain(secret);
  });
});
