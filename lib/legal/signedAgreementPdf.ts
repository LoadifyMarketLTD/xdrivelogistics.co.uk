import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { COMPANY_CONFIG } from '../../app/config/company';
import { buildControlledLegalDocument, type ControlledLegalDocumentCode, type LegalLanguage } from './controlledLegalDocuments';
import type { CurrentLegalEvidence } from './legalAgreementState';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;
const NAVY = rgb(0.043, 0.184, 0.42);
const ORANGE = rgb(0.961, 0.639, 0);
const DARK = rgb(0.10, 0.12, 0.17);
const MUTED = rgb(0.35, 0.40, 0.48);

const canonicalJson = (value: unknown) => JSON.stringify(value);
export const sha256Hex = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
export const hashControlledDocument = (value: unknown) => sha256Hex(canonicalJson(value));

export type SignedLegalAgreementPdfInput = {
  acceptanceId: string;
  signerFullName: string;
  signerEmail: string | null;
  companyName?: string | null;
  evidence: CurrentLegalEvidence;
};

export type SignedLegalAgreementPdfResult = {
  bytes: Uint8Array;
  pdfHash: string;
  signaturePayloadHash: string;
  filename: string;
};

const loadInterFonts = async (pdf: PDFDocument) => {
  pdf.registerFontkit(fontkit);
  const base = join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files');
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(join(base, 'inter-latin-ext-400-normal.woff')),
    readFile(join(base, 'inter-latin-ext-700-normal.woff')),
  ]);
  return {
    regular: await pdf.embedFont(regularBytes, { subset: true }),
    bold: await pdf.embedFont(boldBytes, { subset: true }),
  };
};

const wrapText = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  const paragraphs = text.replace(/\r/g, '').split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = '';
      for (const char of word) {
        const next = chunk + char;
        if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else chunk = next;
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines;
};

const addWriter = (pdf: PDFDocument, regular: PDFFont, bold: PDFFont) => {
  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const ensure = (height: number) => {
    if (y - height >= MARGIN) return;
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const line = (value: string, opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number }) => {
    const size = opts?.size ?? 9.5;
    const font = opts?.bold ? bold : regular;
    const color = opts?.color ?? DARK;
    const lines = wrapText(font, value, size, CONTENT_WIDTH);
    const lineHeight = size * 1.45;
    ensure(Math.max(lineHeight, lines.length * lineHeight) + (opts?.gap ?? 0));
    for (const item of lines) {
      page.drawText(item || ' ', { x: MARGIN, y, size, font, color });
      y -= lineHeight;
    }
    y -= opts?.gap ?? 0;
  };
  const spacer = (height = 8) => { ensure(height); y -= height; };
  const rule = () => {
    ensure(10);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.8, color: rgb(0.84, 0.87, 0.91) });
    y -= 12;
  };
  return { line, spacer, rule };
};

export const buildSignedLegalAgreementPdf = async (input: SignedLegalAgreementPdfInput): Promise<SignedLegalAgreementPdfResult> => {
  const signerFullName = input.signerFullName.trim().replace(/\s+/g, ' ');
  if (signerFullName.length < 2 || signerFullName.length > 120) throw new Error('Signer full name is invalid.');
  if (!/^[0-9a-f]{64}$/.test(input.evidence.evidenceHash)) throw new Error('Legal evidence hash is invalid.');

  const language = input.evidence.acceptanceLanguage as LegalLanguage;
  const documentPairs = input.evidence.agreements.map((snapshot) => {
    const document = buildControlledLegalDocument(snapshot.code as ControlledLegalDocumentCode, language);
    const actualHash = hashControlledDocument(document);
    if (actualHash !== snapshot.documentHash) throw new Error(`Controlled legal document hash mismatch for ${snapshot.code}.`);
    if (document.version !== snapshot.version || document.translationVersion !== snapshot.translationVersion || document.language !== snapshot.language) {
      throw new Error(`Controlled legal document snapshot mismatch for ${snapshot.code}.`);
    }
    return { snapshot, document };
  });
  const privacyDocument = buildControlledLegalDocument('privacy_policy', language);
  const privacyHash = hashControlledDocument(privacyDocument);
  if (privacyHash !== input.evidence.privacyDocumentHash) throw new Error('Controlled privacy document hash mismatch.');

  const signaturePayload = {
    acceptanceId: input.acceptanceId,
    signerFullName,
    signerEmail: input.signerEmail,
    companyName: input.companyName ?? null,
    acceptedAt: input.evidence.acceptedAt,
    acceptanceLanguage: language,
    evidenceHash: input.evidence.evidenceHash,
    agreements: input.evidence.agreements.map(({ code, version, language: lang, translationVersion, documentHash }) => ({ code, version, language: lang, translationVersion, documentHash })),
    privacyVersion: input.evidence.privacyVersion,
    privacyDocumentHash: input.evidence.privacyDocumentHash,
    signatureMethod: 'typed_name_explicit_acceptance',
  };
  const signaturePayloadHash = sha256Hex(canonicalJson(signaturePayload));

  const pdf = await PDFDocument.create();
  pdf.setTitle(`XDrive Signed Legal Agreement ${input.acceptanceId}`);
  pdf.setAuthor(COMPANY_CONFIG.legalName);
  pdf.setSubject('Immutable electronic legal acceptance package');
  pdf.setCreator('XDrive Logistics');
  pdf.setProducer('XDrive Logistics');
  const { regular, bold } = await loadInterFonts(pdf);
  const w = addWriter(pdf, regular, bold);

  w.line(COMPANY_CONFIG.legalName, { size: 18, bold: true, color: NAVY });
  w.line('Signed Legal Agreement Package', { size: 15, bold: true, color: ORANGE, gap: 5 });
  w.line(`Acceptance ID: ${input.acceptanceId}`, { size: 8.5, color: MUTED });
  w.line(`Accepted at: ${input.evidence.acceptedAt}`, { size: 8.5, color: MUTED });
  w.line(`Language: ${language.toUpperCase()}`, { size: 8.5, color: MUTED });
  w.rule();
  w.line('Electronic signature', { size: 12, bold: true, color: NAVY, gap: 3 });
  w.line(`Signer full name: ${signerFullName}`, { size: 10.5, bold: true });
  w.line(`Signer email: ${input.signerEmail ?? 'Not available'}`);
  if (input.companyName) w.line(`Business / company: ${input.companyName}`);
  w.line('Signature method: Typed full name + explicit agreement and declarations');
  w.line(`Signature payload SHA-256: ${signaturePayloadHash}`, { size: 7.5, color: MUTED });
  w.line(`Acceptance evidence SHA-256: ${input.evidence.evidenceHash}`, { size: 7.5, color: MUTED });
  w.spacer(8);
  w.line(input.evidence.acceptanceStatement, { size: 9.5, bold: true });
  w.line(input.evidence.authorityStatement, { size: 9 });
  w.line(input.evidence.roleStatement, { size: 9 });
  w.line(input.evidence.privacyStatement, { size: 9 });
  w.rule();

  for (const { snapshot, document } of documentPairs) {
    w.line(document.title, { size: 14, bold: true, color: NAVY, gap: 2 });
    w.line(`Version ${snapshot.version} · Translation ${snapshot.translationVersion} · ${snapshot.language.toUpperCase()}`, { size: 8.5, color: MUTED });
    w.line(`Document SHA-256: ${snapshot.documentHash}`, { size: 7.5, color: MUTED, gap: 5 });
    w.line(document.intro, { size: 9.5, bold: true, gap: 5 });
    for (const section of document.sections) {
      w.line(section.title, { size: 10.5, bold: true, color: ORANGE, gap: 1 });
      w.line(section.body, { size: 9.2, gap: 6 });
    }
    w.rule();
  }

  w.line(privacyDocument.title, { size: 14, bold: true, color: NAVY, gap: 2 });
  w.line(`Version ${privacyDocument.version} · Translation ${privacyDocument.translationVersion} · ${language.toUpperCase()}`, { size: 8.5, color: MUTED });
  w.line(`Document SHA-256: ${privacyHash}`, { size: 7.5, color: MUTED, gap: 5 });
  w.line(privacyDocument.intro, { size: 9.5, bold: true, gap: 5 });
  for (const section of privacyDocument.sections) {
    w.line(section.title, { size: 10.5, bold: true, color: ORANGE, gap: 1 });
    w.line(section.body, { size: 9.2, gap: 6 });
  }
  w.rule();
  w.line('Integrity certificate', { size: 12, bold: true, color: NAVY });
  w.line(`Evidence SHA-256: ${input.evidence.evidenceHash}`, { size: 7.5 });
  w.line(`Signature payload SHA-256: ${signaturePayloadHash}`, { size: 7.5 });
  w.line(`Generated by ${COMPANY_CONFIG.legalName}, Company No. ${COMPANY_CONFIG.companyNumber}.`, { size: 8.5, color: MUTED });

  const bytes = await pdf.save({ useObjectStreams: false });
  const pdfHash = sha256Hex(bytes);
  const filename = `XDrive-Signed-Agreement-${input.acceptanceId.slice(0, 8).toUpperCase()}.pdf`;
  return { bytes, pdfHash, signaturePayloadHash, filename };
};
