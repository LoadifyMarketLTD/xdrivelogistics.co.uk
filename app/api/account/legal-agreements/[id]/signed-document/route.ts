import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildSignedLegalAgreementPdf } from '../../../../../../lib/legal/signedAgreementPdf';
import type { CurrentLegalEvidence } from '../../../../../../lib/legal/legalAgreementState';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function GET(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { id } = await params;
  if (!UUID_RE.test(id)) return json(400, { error: 'Invalid agreement ID.' });

  const { data: agreement, error } = await supabaseAdmin
    .from('registration_legal_acceptances')
    .select('id, user_id, signer_full_name, registration_role, legal_version, agreements, acceptance_language, acceptance_statement, authority_statement, role_statement, privacy_statement, privacy_version, privacy_document_hash, accepted_at, evidence_hash, signed_pdf_bucket, signed_pdf_path, signed_pdf_hash, signed_pdf_created_at')
    .eq('id', id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (error) {
    if (['42P01', 'PGRST205', '42703'].includes(error.code ?? '')) {
      return json(503, { error: 'Signed agreement storage is not available in this environment.' });
    }
    return json(500, { error: error.message });
  }
  if (!agreement) return json(404, { error: 'Signed agreement not found.' });
  if (agreement.signed_pdf_bucket !== 'documents' || typeof agreement.signed_pdf_path !== 'string' || !agreement.signed_pdf_path) {
    return json(409, { error: 'This historical acceptance does not have a signed PDF package.' });
  }
  const requiredPrefix = `legal-agreements/${authData.user.id}/`;
  if (!agreement.signed_pdf_path.startsWith(requiredPrefix)) {
    return json(409, { error: 'Signed agreement storage reference failed integrity validation.' });
  }

  // The original signed PDF remains immutable. Provide an explicitly labelled
  // readable reconstruction from the acceptance's stored legal evidence.
  if (request.nextUrl.searchParams.get('readable') === '1') {
    try {
      const { data: original, error: downloadError } = await supabaseAdmin.storage
        .from('documents').download(agreement.signed_pdf_path);
      if (downloadError || !original) return json(500, { error: 'Original signed PDF is unavailable.' });
      const originalHash = createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex');
      if (!agreement.signed_pdf_hash || originalHash !== agreement.signed_pdf_hash) {
        return json(409, { error: 'Original signed PDF failed its recorded SHA-256 integrity check.' });
      }
      const snapshots = agreement.agreements;
      if (!Array.isArray(snapshots) || snapshots.some((entry) =>
        !entry || typeof entry !== 'object' || !entry.code || !entry.version ||
        !entry.language || !entry.translationVersion || !entry.documentHash)) {
        return json(409, { error: 'Historic agreement snapshots are incomplete; manual recovery is required.' });
      }
      const evidence: CurrentLegalEvidence = {
        registrationRole: agreement.registration_role,
        legalVersion: agreement.legal_version,
        agreements: snapshots,
        acceptanceLanguage: agreement.acceptance_language,
        acceptanceStatement: agreement.acceptance_statement,
        authorityStatement: agreement.authority_statement,
        roleStatement: agreement.role_statement,
        privacyStatement: agreement.privacy_statement,
        privacyVersion: agreement.privacy_version,
        privacyDocumentHash: agreement.privacy_document_hash,
        acceptedAt: agreement.accepted_at,
        evidenceHash: agreement.evidence_hash,
      };
      const generated = await buildSignedLegalAgreementPdf({
        acceptanceId: agreement.id,
        signerFullName: agreement.signer_full_name,
        // The historical signing email and company may have changed. This is
        // a readable reproduction, never represented as the original signature.
        signerEmail: null,
        companyName: null,
        evidence,
      });
      const pdf = await PDFDocument.load(generated.bytes);
      const cover = pdf.insertPage(0);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      cover.setSize(595.28, 841.89);
      cover.drawText('XDrive Logistics - READABLE RECONSTRUCTION', { x: 44, y: 762, size: 17, font: bold, color: rgb(0.05, 0.18, 0.4) });
      cover.drawText('NOT THE ORIGINAL SIGNED PDF', { x: 44, y: 722, size: 13, font: bold, color: rgb(0.65, 0.15, 0.1) });
      const notes = [
        'This document reproduces the legal texts and acceptance evidence recorded',
        'at the time of acceptance. It is a later readable reconstruction.',
        'The original signed PDF is preserved unchanged in secure storage.',
        'This reproduction does not constitute a new signature or acceptance.',
        'Acceptance ID: ' + agreement.id,
        'Accepted at: ' + agreement.accepted_at,
        'Original signed PDF SHA-256:',
        originalHash,
        'Stored acceptance evidence SHA-256:',
        agreement.evidence_hash,
        'Reconstruction generated: ' + new Date().toISOString(),
      ];
      notes.forEach((line, index) => cover.drawText(line, { x: 44, y: 675 - index * 27, size: line.length > 60 ? 9 : 10, font }));
      const bytes = await pdf.save();
      return json(200, {
        pdfBase64: Buffer.from(bytes).toString('base64'),
        filename: 'XDrive-Readable-Copy-' + id.slice(0, 8).toUpperCase() + '.pdf',
        reproduction: true,
        originalPdfHash: originalHash,
      });
    } catch (cause) {
      console.error('[legal-readable-copy] reconstruction failed', cause);
      return json(409, { error: 'Readable reconstruction requires manual review; original evidence is preserved.' });
    }
  }

  const filename = `XDrive-Signed-Agreement-${id.slice(0, 8).toUpperCase()}.pdf`;
  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(agreement.signed_pdf_path, 120, { download: filename });
  if (signedError || !signed?.signedUrl) return json(500, { error: signedError?.message ?? 'Signed agreement URL could not be created.' });

  return json(200, {
    url: signed.signedUrl,
    filename,
    signerFullName: agreement.signer_full_name,
    pdfHash: agreement.signed_pdf_hash,
    createdAt: agreement.signed_pdf_created_at,
    expiresInSeconds: 120,
  });
}
