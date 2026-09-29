import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { CurrentLegalEvidence } from './legalAgreementState';
import { buildSignedLegalAgreementPdf } from './signedAgreementPdf';

export type SignedLegalAcceptanceSource = 'registration' | 'initial_remediation' | 'material_reacceptance';

export type PersistSignedLegalAcceptanceInput = {
  supabaseAdmin: SupabaseClient;
  userId: string;
  userEmail: string | null;
  companyId: string | null;
  companyName?: string | null;
  onboardingApplicationId: string | null;
  evidence: CurrentLegalEvidence;
  signerFullName: string;
  source: SignedLegalAcceptanceSource;
  userAgent: string | null;
};

export const persistSignedLegalAcceptance = async (input: PersistSignedLegalAcceptanceInput) => {
  const signerFullName = input.signerFullName.trim().replace(/\s+/g, ' ');
  if (signerFullName.length < 2 || signerFullName.length > 120) {
    return { data: null, error: { code: 'SIGNER_NAME_INVALID', message: 'A valid signer full name is required.' } } as const;
  }

  const acceptanceId = randomUUID();
  const pdf = await buildSignedLegalAgreementPdf({
    acceptanceId,
    signerFullName,
    signerEmail: input.userEmail,
    companyName: input.companyName ?? null,
    evidence: input.evidence,
  });
  const objectPath = `legal-agreements/${input.userId}/${acceptanceId}.pdf`;
  const { error: uploadError } = await input.supabaseAdmin.storage
    .from('documents')
    .upload(objectPath, Buffer.from(pdf.bytes), {
      contentType: 'application/pdf',
      upsert: false,
      cacheControl: '3600',
    });

  if (uploadError) {
    return { data: null, error: { code: 'SIGNED_PDF_UPLOAD_FAILED', message: uploadError.message } } as const;
  }

  const signedPdfCreatedAt = new Date().toISOString();
  const { data, error } = await input.supabaseAdmin
    .from('registration_legal_acceptances')
    .insert({
      id: acceptanceId,
      user_id: input.userId,
      company_id: input.companyId,
      onboarding_application_id: input.onboardingApplicationId,
      registration_role: input.evidence.registrationRole,
      legal_version: input.evidence.legalVersion,
      agreements: input.evidence.agreements,
      acceptance_language: input.evidence.acceptanceLanguage,
      privacy_document_hash: input.evidence.privacyDocumentHash,
      translation_snapshot_version: '1',
      acceptance_statement: input.evidence.acceptanceStatement,
      authority_statement: input.evidence.authorityStatement,
      role_statement: input.evidence.roleStatement,
      privacy_statement: input.evidence.privacyStatement,
      privacy_version: input.evidence.privacyVersion,
      accepted_at: input.evidence.acceptedAt,
      source: input.source,
      user_agent: input.userAgent,
      evidence_hash: input.evidence.evidenceHash,
      signer_full_name: signerFullName,
      signature_method: 'typed_name_explicit_acceptance',
      signature_payload_hash: pdf.signaturePayloadHash,
      signed_pdf_bucket: 'documents',
      signed_pdf_path: objectPath,
      signed_pdf_hash: pdf.pdfHash,
      signed_pdf_created_at: signedPdfCreatedAt,
      signature_snapshot_version: '1',
    })
    .select('id, registration_role, legal_version, agreements, privacy_version, acceptance_language, privacy_document_hash, accepted_at, source, evidence_hash, signer_full_name, signature_method, signature_payload_hash, signed_pdf_bucket, signed_pdf_path, signed_pdf_hash, signed_pdf_created_at, created_at')
    .single();

  if (error) {
    await input.supabaseAdmin.storage.from('documents').remove([objectPath]).catch(() => undefined);
    return { data: null, error } as const;
  }

  return { data, error: null, filename: pdf.filename } as const;
};
