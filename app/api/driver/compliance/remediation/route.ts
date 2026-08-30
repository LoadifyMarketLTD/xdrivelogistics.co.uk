import crypto from 'node:crypto';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { resolveDriverOperationalEligibility } from '../../_lib/operationalEligibility';
import {
  isComplianceDriverContext,
  resolveComplianceDriver,
  type ComplianceDriverContext,
} from '../_lib';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const OWNER_REQUIRED_IDENTITY_DOCS = [
  'driving_licence',
  'proof_of_address',
  'right_to_work',
  'insurance',
] as const;
const COMPANY_DRIVER_REQUIRED_IDENTITY_DOCS = [
  'driving_licence',
  'proof_of_address',
  'right_to_work',
] as const;

const LEGACY_MAP: Record<string, string> = {
  'Driving Licence': 'driving_licence',
  'CPC Card': 'cpc',
  Insurance: 'insurance',
};

const today = () => new Date().toISOString().slice(0, 10);

const isCurrentLegacyEvidence = (row: {
  issued_date?: string | null;
  expiry_date?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
}) => {
  const current = today();
  if (!row.verified_by || !row.verified_at) return false;
  if (row.issued_date && row.issued_date > current) return false;
  if (row.expiry_date && row.expiry_date < current) return false;
  return true;
};

async function loadApplication(context: ComplianceDriverContext) {
  const { data, error } = await supabaseAdmin!
    .from('onboarding_applications')
    .select('id,user_id,company_id,account_type,workspace_mode,owner_driver_workspace,status,current_step,risk_status,submitted_at,payload')
    .eq('user_id', context.userId)
    .maybeSingle();
  return { data, error };
}

async function loadRemediationSnapshot(context: ComplianceDriverContext) {
  const applicationResult = await loadApplication(context);
  if (applicationResult.error) throw new Error(applicationResult.error.message);
  const application = applicationResult.data;

  const identityPromise = application
    ? supabaseAdmin!
        .from('driver_identity_documents')
        .select('id,onboarding_application_id,doc_type,file_path,upload_status,verification_status,issued_date,expiry_date,reviewed_at,review_notes,created_at,updated_at')
        .eq('onboarding_application_id', application.id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [identityResult, legacyResult, vehiclesResult] = await Promise.all([
    identityPromise,
    supabaseAdmin!
      .from('driver_documents')
      .select('id,doc_type,status,file_path,issued_date,expiry_date,verified_by,verified_at,rejection_reason,created_at')
      .eq('driver_id', context.driverId)
      .order('created_at', { ascending: false }),
    supabaseAdmin!
      .from('vehicles')
      .select('id,registration,assigned_driver_id,status,type,make,model')
      .eq('company_id', context.companyId)
      .eq('assigned_driver_id', context.driverId)
      .eq('status', 'active')
      .limit(5),
  ]);

  const firstError = identityResult.error ?? legacyResult.error ?? vehiclesResult.error;
  if (firstError) throw new Error(firstError.message);

  const vehicles = vehiclesResult.data ?? [];
  const vehicleIds = vehicles.map((vehicle) => String(vehicle.id));
  const vehicleDocumentsResult = vehicleIds.length
    ? await supabaseAdmin!
        .from('vehicle_documents')
        .select('id,vehicle_id,doc_type,status,file_path,issued_date,expiry_date,verified_at,rejection_reason,created_at')
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  if (vehicleDocumentsResult.error) throw new Error(vehicleDocumentsResult.error.message);

  let operational;
  try {
    operational = await resolveDriverOperationalEligibility(supabaseAdmin!, context.driverId);
  } catch {
    operational = {
      eligible: false,
      canonicalVehicleId: null,
      blockers: ['operational_eligibility_unavailable'],
      checks: null,
    };
  }

  const requiredIdentityDocs = context.driverType === 'owner_driver'
    ? [...OWNER_REQUIRED_IDENTITY_DOCS]
    : [...COMPANY_DRIVER_REQUIRED_IDENTITY_DOCS];

  const identityDocuments = identityResult.data ?? [];
  const missingRequiredIdentityDocs = requiredIdentityDocs.filter((docType) =>
    !identityDocuments.some((document) =>
      document.doc_type === docType
      && document.verification_status === 'verified'
      && Boolean(document.file_path)
      && (!document.expiry_date || document.expiry_date >= today()),
    ),
  );

  const legacyDocuments = (legacyResult.data ?? []).map((document) => {
    const canonicalDocType = LEGACY_MAP[String(document.doc_type ?? '')] ?? null;
    const supportedForDriver = Boolean(
      canonicalDocType
      && (context.driverType === 'owner_driver' || canonicalDocType !== 'insurance'),
    );
    return {
      ...document,
      canonical_doc_type: supportedForDriver ? canonicalDocType : null,
      reconcile_eligible:
        document.status === 'approved'
        && Boolean(document.file_path)
        && supportedForDriver
        && isCurrentLegacyEvidence(document),
    };
  });

  return {
    application,
    identityDocuments,
    requiredIdentityDocs,
    missingRequiredIdentityDocs,
    legacyDocuments,
    vehicles,
    vehicleDocuments: vehicleDocumentsResult.data ?? [],
    operational,
  };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveComplianceDriver(request);
  if (!isComplianceDriverContext(resolved)) return resolved;

  try {
    const snapshot = await loadRemediationSnapshot(resolved);
    return json(200, {
      driver: {
        id: resolved.driverId,
        companyId: resolved.companyId,
        driverType: resolved.driverType,
        appAccess: resolved.appAccess,
        canCommercialBid: resolved.canCommercialBid,
      },
      ...snapshot,
    });
  } catch {
    return json(500, { error: 'Compliance remediation status could not be loaded.' });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await resolveComplianceDriver(request);
  if (!isComplianceDriverContext(resolved)) return resolved;

  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (!body || body.action !== 'reconcile_legacy_identity_documents') {
    return json(400, { error: 'Unsupported compliance remediation action.' });
  }

  const applicationResult = await loadApplication(resolved);
  if (applicationResult.error) return json(500, { error: 'Canonical remediation application could not be loaded.' });
  const application = applicationResult.data;
  if (!application) return json(409, { error: 'Canonical remediation application is missing.' });

  const expectedAccountType = resolved.driverType === 'owner_driver' ? 'owner_driver' : 'individual_driver';
  if (application.company_id !== resolved.companyId || application.account_type !== expectedAccountType) {
    return json(409, { error: 'Canonical remediation application does not match this Driver identity.' });
  }

  const permittedLegacyTypes = resolved.driverType === 'owner_driver'
    ? ['Driving Licence', 'CPC Card', 'Insurance']
    : ['Driving Licence', 'CPC Card'];

  const { data: legacyRows, error: legacyError } = await supabaseAdmin!
    .from('driver_documents')
    .select('id,doc_type,status,file_path,issued_date,expiry_date,verified_by,verified_at,created_at')
    .eq('driver_id', resolved.driverId)
    .eq('status', 'approved')
    .in('doc_type', permittedLegacyTypes)
    .not('file_path', 'is', null)
    .order('verified_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (legacyError) return json(500, { error: 'Approved legacy Driver documents could not be loaded.' });

  const latestByCanonicalType = new Map<string, (typeof legacyRows)[number]>();
  for (const row of legacyRows ?? []) {
    const canonicalType = LEGACY_MAP[String(row.doc_type ?? '')];
    if (!canonicalType || latestByCanonicalType.has(canonicalType)) continue;
    if (!isCurrentLegacyEvidence(row)) continue;
    latestByCanonicalType.set(canonicalType, row);
  }

  const reconciled: string[] = [];
  const alreadyCanonical: string[] = [];

  for (const [canonicalType, legacy] of latestByCanonicalType) {
    const { data: existing, error: existingError } = await supabaseAdmin!
      .from('driver_identity_documents')
      .select('id')
      .eq('onboarding_application_id', application.id)
      .eq('doc_type', canonicalType)
      .eq('verification_status', 'verified')
      .not('file_path', 'is', null)
      .limit(1)
      .maybeSingle();
    if (existingError) return json(500, { error: `Canonical ${canonicalType} evidence could not be checked.` });
    if (existing) {
      alreadyCanonical.push(canonicalType);
      continue;
    }

    const sourcePath = String(legacy.file_path ?? '').replace(/^\/+/, '');
    if (!sourcePath) continue;
    const { data: storedFile, error: downloadError } = await supabaseAdmin!.storage
      .from('driver-docs')
      .download(sourcePath);
    if (downloadError || !storedFile) {
      return json(409, { error: `Approved legacy ${legacy.doc_type} evidence could not be recovered from secure storage.` });
    }

    const bytes = Buffer.from(await storedFile.arrayBuffer());
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
      return json(409, { error: `Approved legacy ${legacy.doc_type} evidence has an invalid stored size.` });
    }
    const fileSha256 = crypto.createHash('sha256').update(bytes).digest('hex');

    const { data: fingerprint, error: fingerprintError } = await supabaseAdmin!
      .from('document_fingerprints')
      .select('id,user_id,onboarding_application_id')
      .eq('file_sha256', fileSha256)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fingerprintError) return json(503, { error: 'Document fingerprint registry is unavailable.' });
    if (fingerprint && fingerprint.user_id !== resolved.userId) {
      return json(409, {
        error: `Approved legacy ${legacy.doc_type} matches evidence owned by another identity. Platform review is required before reconciliation.`,
      });
    }

    const sourceExtension = path.extname(sourcePath).toLowerCase();
    const safeExtension = /^\.(pdf|jpe?g|png|webp)$/.test(sourceExtension) ? sourceExtension : '.bin';
    const targetPath = `${resolved.userId}/${application.id}/legacy-${legacy.id}-${canonicalType}${safeExtension}`;
    const contentType = storedFile.type || undefined;

    const { error: uploadError } = await supabaseAdmin!.storage
      .from('onboarding-documents')
      .upload(targetPath, bytes, { contentType, upsert: true });
    if (uploadError) return json(500, { error: `Approved legacy ${legacy.doc_type} could not be copied into canonical secure storage.` });

    const { data: inserted, error: insertError } = await supabaseAdmin!
      .from('driver_identity_documents')
      .insert({
        onboarding_application_id: application.id,
        doc_type: canonicalType,
        file_path: targetPath,
        file_sha256: fileSha256,
        upload_status: 'uploaded',
        verification_status: 'verified',
        issued_date: legacy.issued_date ?? null,
        expiry_date: legacy.expiry_date ?? null,
        reviewed_by: legacy.verified_by ?? null,
        reviewed_at: legacy.verified_at ?? null,
        review_notes: `Reconciled from approved legacy Driver document ${legacy.id}; original review preserved.`,
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      await supabaseAdmin!.storage.from('onboarding-documents').remove([targetPath]);
      return json(500, { error: `Canonical ${canonicalType} evidence record could not be created.` });
    }

    if (!fingerprint) {
      const { error: registryError } = await supabaseAdmin!
        .from('document_fingerprints')
        .insert({
          document_family: 'identity',
          document_id: inserted.id,
          onboarding_application_id: application.id,
          user_id: resolved.userId,
          company_id: resolved.companyId,
          file_sha256: fileSha256,
        });
      if (registryError) {
        await supabaseAdmin!.from('driver_identity_documents').delete().eq('id', inserted.id);
        await supabaseAdmin!.storage.from('onboarding-documents').remove([targetPath]);
        return json(503, { error: 'Canonical document fingerprint could not be registered safely.' });
      }
    }

    reconciled.push(canonicalType);
  }

  try {
    const snapshot = await loadRemediationSnapshot(resolved);
    return json(200, {
      ok: true,
      reconciled,
      alreadyCanonical,
      ...snapshot,
    });
  } catch {
    return json(200, { ok: true, reconciled, alreadyCanonical });
  }
}
