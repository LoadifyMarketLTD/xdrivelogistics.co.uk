import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import {
  isCompanyCapabilityContext,
  requireCompanyCapability,
} from '../../admin/_lib/requireCompanyCapability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

type ComplianceState =
  | 'fully_compliant'
  | 'about_to_expire'
  | 'updates_needed'
  | 'no_evidence';

function complianceForDocuments(
  documents: Array<{ status: string | null; expiry_date: string | null }>,
): ComplianceState {
  if (!documents.length) return 'no_evidence';
  const now = Date.now();
  const thirtyDays = 30 * 86_400_000;
  const hasUpdatesNeeded = documents.some(
    (document) => String(document.status ?? '').trim().toLowerCase() !== 'approved',
  );
  const hasExpired = documents.some(
    (document) => Boolean(document.expiry_date)
      && new Date(document.expiry_date as string).getTime() < now,
  );
  const hasExpiringSoon = documents.some((document) => {
    if (!document.expiry_date) return false;
    const diff = new Date(document.expiry_date).getTime() - now;
    return diff >= 0 && diff <= thirtyDays;
  });
  if (hasUpdatesNeeded || hasExpired) return 'updates_needed';
  if (hasExpiringSoon) return 'about_to_expire';
  return 'fully_compliant';
}

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const auth = await requireCompanyCapability(request, companyId, {
    anyOf: ['company.manage', 'documents.company.manage', 'fleet.positions.view'],
  });
  if (!isCompanyCapabilityContext(auth)) return auth;

  const { data: rows, error } = await supabaseAdmin!
    .from('company_watchlist')
    .select('id,target_company_id,created_at')
    .eq('owner_company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return json(500, { error: 'Supplier watchlist could not be loaded.' });

  const targetIds = [...new Set((rows ?? []).map((row) => row.target_company_id).filter(Boolean))];
  if (!targetIds.length) {
    return json(200, {
      items: [],
      summary: { total: 0, fullyCompliant: 0, aboutToExpire: 0, updatesNeeded: 0 },
    });
  }

  const [
    { data: companies, error: companiesError },
    { data: documents, error: documentsError },
  ] = await Promise.all([
    supabaseAdmin!
      .from('companies')
      .select('id,name,trading_name,legal_name,xd_id,status')
      .in('id', targetIds),
    supabaseAdmin!
      .from('company_documents')
      .select('company_id,status,expiry_date')
      .in('company_id', targetIds),
  ]);

  if (companiesError || documentsError) {
    return json(500, { error: 'Supplier compliance data could not be loaded.' });
  }

  const companyById = new Map(
    (companies ?? []).map((company) => [String(company.id), company]),
  );
  const documentsByCompany = new Map<
    string,
    Array<{ status: string | null; expiry_date: string | null }>
  >();

  for (const document of documents ?? []) {
    const key = String(document.company_id);
    const companyDocuments = documentsByCompany.get(key) ?? [];
    companyDocuments.push({ status: document.status, expiry_date: document.expiry_date });
    documentsByCompany.set(key, companyDocuments);
  }

  const items = (rows ?? []).map((row) => {
    const targetCompanyId = String(row.target_company_id);
    const company = companyById.get(targetCompanyId) ?? null;
    const compliance = complianceForDocuments(documentsByCompany.get(targetCompanyId) ?? []);
    return {
      id: row.id,
      companyId: targetCompanyId,
      companyName: company?.trading_name || company?.name || company?.legal_name || 'Member',
      memberId: company?.xd_id ?? null,
      companyStatus: company?.status ?? null,
      createdAt: row.created_at,
      compliance,
    };
  });

  return json(200, {
    items,
    summary: {
      total: items.length,
      fullyCompliant: items.filter((item) => item.compliance === 'fully_compliant').length,
      aboutToExpire: items.filter((item) => item.compliance === 'about_to_expire').length,
      updatesNeeded: items.filter(
        (item) => item.compliance === 'updates_needed' || item.compliance === 'no_evidence',
      ).length,
    },
  });
}
