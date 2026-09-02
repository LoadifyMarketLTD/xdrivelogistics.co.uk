import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type FlagDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'Marketplace' | 'Operations' | 'Finance' | 'Compliance' | 'Platform' | 'Governance';
  enabled: boolean;
};

const FLAG_DEFINITIONS: FlagDefinition[] = [
  { key: 'exchange_marketplace', label: 'Exchange Marketplace', description: 'Allows companies to post jobs to the public exchange for bidding.', category: 'Marketplace', enabled: true },
  { key: 'bid_acceptance_workflow', label: 'Bid Acceptance Workflow', description: 'Companies can accept/reject inbound bids on exchange jobs.', category: 'Operations', enabled: true },
  { key: 'pod_capture', label: 'Proof of Delivery Capture', description: 'Drivers can capture POD photos and signature on delivery.', category: 'Operations', enabled: true },
  { key: 'invoice_generation', label: 'Invoice Generation', description: 'Automatic invoice creation on job delivery confirmation.', category: 'Finance', enabled: true },
  { key: 'dispute_filing', label: 'Invoice Dispute Filing', description: 'Companies can raise disputes against issued invoices.', category: 'Finance', enabled: true },
  { key: 'stripe_billing_future_phase', label: 'Stripe Billing (Future Phase)', description: 'Stripe checkout/connect automation — explicitly out of MVP scope.', category: 'Finance', enabled: false },
  { key: 'notifications', label: 'Notification System', description: 'In-app and email notifications for job events.', category: 'Platform', enabled: true },
  { key: 'document_review', label: 'Document Review Queue', description: 'Admin can review and approve uploaded compliance documents.', category: 'Compliance', enabled: true },
  { key: 'broker_carrier_network', label: 'Broker Carrier Network', description: 'Brokers can invite and manage a private carrier network.', category: 'Marketplace', enabled: true },
  { key: 'driver_mobile_app', label: 'Driver Mobile App', description: 'Native Android/iOS app for driver job management.', category: 'Operations', enabled: true },
  { key: 'company_suspension', label: 'Company Suspension Controls', description: 'Super admin can suspend and reinstate companies.', category: 'Governance', enabled: true },
  { key: 'audit_logging', label: 'Audit Logging', description: 'All governance actions are written to the owner audit log.', category: 'Platform', enabled: true },
];

type GlobalSettingDefinition = {
  key: string;
  label: string;
  category: 'Platform Identity' | 'Marketplace Rules' | 'Compliance' | 'Onboarding';
  value: string;
  type: 'text' | 'number' | 'boolean';
};

const GLOBAL_SETTING_DEFINITIONS: GlobalSettingDefinition[] = [
  { key: 'platform_name', label: 'Platform Name', value: 'XDrive Logistics', type: 'text', category: 'Platform Identity' },
  { key: 'platform_domain', label: 'Primary Domain', value: 'xdrivelogistics.co.uk', type: 'text', category: 'Platform Identity' },
  { key: 'support_email', label: 'Support Email', value: 'contact@xdrivelogistics.co.uk', type: 'text', category: 'Platform Identity' },
  { key: 'default_currency', label: 'Default Currency', value: 'GBP', type: 'text', category: 'Platform Identity' },
  { key: 'default_timezone', label: 'Default Timezone', value: 'Europe/London', type: 'text', category: 'Platform Identity' },
  { key: 'min_bid_interval_minutes', label: 'Min Bid Interval (minutes)', value: '5', type: 'number', category: 'Marketplace Rules' },
  { key: 'max_bids_per_job', label: 'Max Bids per Job', value: '25', type: 'number', category: 'Marketplace Rules' },
  { key: 'exchange_auto_expire_hours', label: 'Exchange Job Auto-Expire (hours)', value: '72', type: 'number', category: 'Marketplace Rules' },
  { key: 'vat_rate_default_pct', label: 'Default VAT Rate (%)', value: '20', type: 'number', category: 'Marketplace Rules' },
  { key: 'doc_expiry_warning_days', label: 'Document Expiry Warning (days)', value: '30', type: 'number', category: 'Compliance' },
  { key: 'compliance_block_posting', label: 'Block Posting on Compliance Failure', value: 'true', type: 'boolean', category: 'Compliance' },
  { key: 'driver_doc_required', label: 'Required Driver Docs', value: 'driving_licence, cpc_card, insurance', type: 'text', category: 'Compliance' },
  { key: 'vehicle_doc_required', label: 'Required Vehicle Docs', value: 'mot, insurance', type: 'text', category: 'Compliance' },
  { key: 'company_approval_required', label: 'Company Approval Required', value: 'true', type: 'boolean', category: 'Onboarding' },
  { key: 'invite_email_provider', label: 'Invite Email Provider', value: 'Supabase Auth', type: 'text', category: 'Onboarding' },
  { key: 'default_company_status', label: 'New Company Default Status', value: 'pending_approval', type: 'text', category: 'Onboarding' },
];

const featureFlagUpdateSchema = z.object({
  section: z.literal('feature-flags'),
  flags: z.array(z.object({ key: z.string().min(1), enabled: z.boolean() })).min(1),
  reason: z.string().trim().min(5).max(5000),
});

const globalSettingsUpdateSchema = z.object({
  section: z.literal('global'),
  settings: z.array(z.object({ key: z.string().min(1), value: z.string().max(5000) })).min(1),
  reason: z.string().trim().min(5).max(5000),
});

const parseBooleanValue = (value: string) => {
  const normalised = value.trim().toLowerCase();
  if (normalised === 'true') return 'true';
  if (normalised === 'false') return 'false';
  return null;
};

const governanceErrorResponse = (error: { code?: string; message?: string }) => {
  if (error.code === '42501') return respond(403, { error: 'Platform Owner authority required.' });
  if (error.code === '23514' || error.code === '23502' || error.code === '22P02') {
    return respond(409, { error: error.message ?? 'Platform configuration validation failed.' });
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return respond(503, { error: 'Canonical Platform settings governance is not available in this environment.', migrationRequired: true });
  }
  return respond(500, { error: error.message ?? 'Platform configuration update failed.' });
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const section = request.nextUrl.searchParams.get('section')?.trim();
  if (!section) return respond(400, { error: 'section is required (feature-flags, global, or roles).' });

  if (section === 'feature-flags') {
    const { data, error } = await supabaseAdmin.from('platform_feature_flags').select('key, is_enabled');
    if (error) return respond(500, { error: error.message });
    const enabledByKey = new Map((data ?? []).map((row) => [row.key, Boolean(row.is_enabled)]));
    return respond(200, {
      section,
      flags: FLAG_DEFINITIONS.map((flag) => ({ ...flag, enabled: enabledByKey.has(flag.key) ? enabledByKey.get(flag.key) : flag.enabled })),
      summary: {
        total: FLAG_DEFINITIONS.length,
        enabled: FLAG_DEFINITIONS.filter((flag) => enabledByKey.has(flag.key) ? Boolean(enabledByKey.get(flag.key)) : flag.enabled).length,
      },
    });
  }

  if (section === 'global') {
    const { data, error } = await supabaseAdmin.from('platform_settings').select('key, value, value_type');
    if (error) return respond(500, { error: error.message });
    const valueByKey = new Map((data ?? []).map((row) => [row.key, { value: row.value, value_type: row.value_type }]));
    return respond(200, {
      section,
      settings: GLOBAL_SETTING_DEFINITIONS.map((setting) => {
        const stored = valueByKey.get(setting.key);
        return { ...setting, value: stored?.value ?? setting.value, type: stored?.value_type ?? setting.type };
      }),
    });
  }

  if (section === 'roles') {
    return respond(200, {
      section,
      roles: null,
      readOnly: true,
      note: 'Role authority is defined by the canonical role registry and authoritative identity/workspace sources; it is not editable through Platform settings.',
    });
  }

  return respond(400, { error: 'Invalid section. Use feature-flags, global, or roles.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    if (isSuperAdminDeployPreviewReadOnly()) return respond(403, { error: 'Deploy Preview is read-only. Platform settings were not changed.' });
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return respond(400, { error: 'Invalid JSON body.' }); }

  if (body && typeof body === 'object' && 'section' in body && (body as { section?: unknown }).section === 'roles') {
    return respond(409, { error: 'Roles & Permissions is read-only. Delegated Platform Administrator or arbitrary role mutation is not implemented.' });
  }

  const parsedFlags = featureFlagUpdateSchema.safeParse(body);
  if (parsedFlags.success) {
    const definitionByKey = new Map(FLAG_DEFINITIONS.map((flag) => [flag.key, flag]));
    const invalidKeys = parsedFlags.data.flags.map((flag) => flag.key).filter((key) => !definitionByKey.has(key));
    if (invalidKeys.length > 0) return respond(400, { error: `Unknown feature flag keys: ${invalidKeys.join(', ')}` });

    const changes = parsedFlags.data.flags.map((flag) => {
      const definition = definitionByKey.get(flag.key)!;
      return { key: definition.key, label: definition.label, description: definition.description, category: definition.category, enabled: flag.enabled };
    });

    const { data, error } = await supabaseAdmin.rpc('owner_update_platform_configuration', {
      p_actor_user_id: owner.id,
      p_section: 'feature-flags',
      p_changes: changes,
      p_reason: parsedFlags.data.reason,
    });
    if (error) return governanceErrorResponse(error);
    const result = Array.isArray(data) ? data[0] ?? null : data;
    if (!result) return respond(500, { error: 'Platform feature flag update returned no authoritative result.' });
    return respond(200, { success: true, updated: Number(result.updated_count ?? 0), result });
  }

  const parsedSettings = globalSettingsUpdateSchema.safeParse(body);
  if (parsedSettings.success) {
    const definitionByKey = new Map(GLOBAL_SETTING_DEFINITIONS.map((setting) => [setting.key, setting]));
    const invalidKeys = parsedSettings.data.settings.map((setting) => setting.key).filter((key) => !definitionByKey.has(key));
    if (invalidKeys.length > 0) return respond(400, { error: `Unknown global setting keys: ${invalidKeys.join(', ')}` });

    const changes: Array<{ key: string; label: string; value: string; value_type: 'text' | 'number' | 'boolean'; category: string }> = [];
    for (const setting of parsedSettings.data.settings) {
      const definition = definitionByKey.get(setting.key)!;
      const rawValue = setting.value.trim();
      if (definition.type === 'number' && !Number.isFinite(Number(rawValue))) return respond(400, { error: `Setting '${setting.key}' must be a valid number.` });
      if (definition.type === 'boolean' && parseBooleanValue(rawValue) === null) return respond(400, { error: `Setting '${setting.key}' must be true or false.` });
      changes.push({
        key: definition.key,
        label: definition.label,
        value: definition.type === 'boolean' ? (parseBooleanValue(rawValue) as 'true' | 'false') : rawValue,
        value_type: definition.type,
        category: definition.category,
      });
    }

    const { data, error } = await supabaseAdmin.rpc('owner_update_platform_configuration', {
      p_actor_user_id: owner.id,
      p_section: 'global',
      p_changes: changes,
      p_reason: parsedSettings.data.reason,
    });
    if (error) return governanceErrorResponse(error);
    const result = Array.isArray(data) ? data[0] ?? null : data;
    if (!result) return respond(500, { error: 'Platform settings update returned no authoritative result.' });
    return respond(200, { success: true, updated: Number(result.updated_count ?? 0), result });
  }

  return respond(400, { error: 'Validation failed. Feature flags and global settings require a written reason of at least 5 characters.' });
}
