import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

export async function getBlockedCounterpartyCompanyIds(
  client: AdminClient,
  companyId: string | null | undefined,
): Promise<{ ids: Set<string>; error: string | null }> {
  const id = String(companyId ?? '').trim();
  if (!id) return { ids: new Set(), error: null };

  const [outgoing, incoming] = await Promise.all([
    client
      .from('company_member_blocks')
      .select('blocked_company_id')
      .eq('blocker_company_id', id),
    client
      .from('company_member_blocks')
      .select('blocker_company_id')
      .eq('blocked_company_id', id),
  ]);

  if (outgoing.error) return { ids: new Set(), error: outgoing.error.message };
  if (incoming.error) return { ids: new Set(), error: incoming.error.message };

  const ids = new Set<string>();
  for (const row of outgoing.data ?? []) if (row.blocked_company_id) ids.add(String(row.blocked_company_id));
  for (const row of incoming.data ?? []) if (row.blocker_company_id) ids.add(String(row.blocker_company_id));
  return { ids, error: null };
}

export async function areCompaniesBlocked(
  client: AdminClient,
  companyAId: string | null | undefined,
  companyBId: string | null | undefined,
): Promise<{ blocked: boolean; error: string | null }> {
  const a = String(companyAId ?? '').trim();
  const b = String(companyBId ?? '').trim();
  if (!a || !b || a === b) return { blocked: false, error: null };

  const { ids, error } = await getBlockedCounterpartyCompanyIds(client, a);
  if (error) return { blocked: false, error };
  return { blocked: ids.has(b), error: null };
}
