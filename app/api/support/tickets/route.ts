import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(['billing', 'operations', 'technical', 'compliance', 'general']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

const resolveCompanyId = async (userId: string) => {
  if (!supabaseAdmin) return null;

  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membership?.company_id) return membership.company_id as string;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile?.company_id) return profile.company_id as string;

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return (driver?.company_id as string | null) ?? null;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const companyId = await resolveCompanyId(authData.user.id);
  const { subject, description, category, priority } = parsed.data;

  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      company_id: companyId,
      raised_by_user_id: authData.user.id,
      subject,
      description,
      category,
      priority,
      status: 'open',
    })
    .select('id, subject, category, priority, status, created_at')
    .single();

  if (error) return respond(500, { error: error.message });

  return respond(201, { ticket });
}
