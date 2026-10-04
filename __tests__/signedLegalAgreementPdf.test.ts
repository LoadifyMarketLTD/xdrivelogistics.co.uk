import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildCurrentLegalEvidence } from '../lib/legal/legalAgreementState';
import { buildSignedLegalAgreementPdf } from '../lib/legal/signedAgreementPdf';

const acceptanceId = '11111111-2222-4333-8444-555555555555';
const acceptedAt = '2026-09-26T14:10:00.000Z';

describe('signed legal agreement PDF', () => {
  it('generates a real multilingual PDF with integrity hashes', { timeout: 15_000 }, async () => {
    const evidence = buildCurrentLegalEvidence('customer_shipper', acceptedAt, 'ro');
    const result = await buildSignedLegalAgreementPdf({
      acceptanceId,
      signerFullName: 'Ion Daniel Preda',
      signerEmail: 'test@example.com',
      companyName: 'Example Logistics SRL',
      evidence,
    });

    expect(result.bytes.byteLength).toBeGreaterThan(10_000);
    expect(Buffer.from(result.bytes).subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(result.pdfHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.signaturePayloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.acceptanceStatement).toContain('limba română');
    expect(result.filename).toContain('XDrive-Signed-Agreement');

    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(2);
  });

  it('binds the signature hash to the signer identity', { timeout: 15_000 }, async () => {
    const evidence = buildCurrentLegalEvidence('transport_broker', acceptedAt, 'pl');
    const first = await buildSignedLegalAgreementPdf({
      acceptanceId,
      signerFullName: 'Jan Kowalski',
      signerEmail: 'jan@example.com',
      evidence,
    });
    const second = await buildSignedLegalAgreementPdf({
      acceptanceId,
      signerFullName: 'Anna Kowalska',
      signerEmail: 'jan@example.com',
      evidence,
    });
    expect(first.signaturePayloadHash).not.toBe(second.signaturePayloadHash);
  });

  it('refuses to generate a PDF if a controlled document hash is tampered', async () => {
    const evidence = buildCurrentLegalEvidence('fleet_operator', acceptedAt, 'fr');
    evidence.agreements[0].documentHash = '0'.repeat(64);
    await expect(buildSignedLegalAgreementPdf({
      acceptanceId,
      signerFullName: 'Jean Dupont',
      signerEmail: null,
      evidence,
    })).rejects.toThrow(/hash mismatch/i);
  });

  it.each(['ur', 'pa-guru', 'pa-shah', 'hi', 'bn', 'gu'] as const)(
    'generates a valid signed PDF evidence package for supplemental legal language %s',
    { timeout: 15_000 },
    async (language) => {
      const evidence = buildCurrentLegalEvidence('owner_operator', acceptedAt, language);
      const result = await buildSignedLegalAgreementPdf({
        acceptanceId,
        signerFullName: `Signer ${language.toUpperCase()}`,
        signerEmail: `${language}@example.com`,
        companyName: 'XDrive Multilingual Legal Test',
        evidence,
      });
      expect(Buffer.from(result.bytes).subarray(0, 4).toString('ascii')).toBe('%PDF');
      expect(result.bytes.byteLength).toBeGreaterThan(10_000);
      expect(result.pdfHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.signaturePayloadHash).toMatch(/^[0-9a-f]{64}$/);
      const loaded = await PDFDocument.load(result.bytes);
      expect(loaded.getPageCount()).toBeGreaterThan(0);
    },
  );

  it.each(['en', 'ro', 'fr', 'es', 'pl'] as const)(
    'generates a valid signed PDF for controlled legal language %s',
    async (language) => {
      const evidence = buildCurrentLegalEvidence('customer_shipper', acceptedAt, language);
      const result = await buildSignedLegalAgreementPdf({
        acceptanceId,
        signerFullName: `Signer ${language.toUpperCase()}`,
        signerEmail: `${language}@example.com`,
        companyName: 'XDrive E2E Legal Test',
        evidence,
      });
      expect(Buffer.from(result.bytes).subarray(0, 4).toString('ascii')).toBe('%PDF');
      expect(result.bytes.byteLength).toBeGreaterThan(10_000);
      expect(result.pdfHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.signaturePayloadHash).toMatch(/^[0-9a-f]{64}$/);
      const loaded = await PDFDocument.load(result.bytes);
      expect(loaded.getPageCount()).toBeGreaterThan(2);
    },
  );
});
