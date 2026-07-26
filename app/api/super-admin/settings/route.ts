import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

type FlagDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'Marketplace' | 'Operations' | 'Finance' | 'Compliance' | 'Platform';
  enabled: boolean;
};

const FLAG_DEFINITIONS: FlagDefinition[] = [
  {
    key: 'exchange_marketplace',
    label: 'Exchange Marketplace',
    description: 'Allows companies to post jobs to the public exchange for bidding.',
    category: 'Marketplace',
    enabled: true,
  },
  {
    key: 'bid_acceptance_workflow',
    label: 'Bid Acceptance Workflow',
    description: 'Companies can accept/reject inbound bids on exchange jobs.',
    category: 'Operations',
    enabled: true,
  },
  {
    key: 'pod_capture',
    label: 'Proof of Delivery Capture',
    description: 'Drivers can capture POD photos and signature on delivery.',
    category: 'Operations',
    enabled: true,
  },
  {
    key: 'invoice_generation',
    label: 'Invoice Generation',
    description: 'Automatic invoice creation on job delivery confirmation.',
    category: 'Finance',
    enabled: true,
  },
  {
    key: 'dispute_filing',
    label: 'Invoice Dispute Filing',
    description: 'Companies can raise disputes against issued invoices.',
    category: 'Finance',
    enabled: true,
  },
  {
    key: 'stripe_billing_future_phase',
    label: 'Stripe Billing (Future Phase)',
    description: 'Stripe checkout/connect automation is explicitly out of MVP scope.',
    category: 'Finance',
    enabled: false,
  },
  {
    key: 'notifications',
    label: 'Notification System',
    description: 'Real-time notifications for job events, bids, and compliance alerts.',
    category: 'Platform',
    enabled: true,
  },
  {
    key: 'driver_tracking',
    label: 'Live Driver Tracking',
    description: 'GPS location tracking for active driver deliveries.',
    category: 'Operations',
    enabled: true,
  },
  {
    key: 'public_quote_requests',
    label: 'Public Quote Requests',
    description: 'Anonymous visitors can request quotes via the marketing site.',
    category: 'Marketplace',
    enabled: true,
  },
  {
    key: 'compliance_gating',
    label: 'Compliance Gating',
    description:
      'Blocks job posting for companies with outstanding compliance issues.',
    category: 'Compliance',
    enabled: true,
  },
];

type GlobalSettingDefinition = {
  key: string;
  label: string;
  category:
    | 'Platform Identity'
    | 'Marketplace Rules'
    | 'Compliance'
    | 'Onboarding';
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
});

const globalSettingsUpdateSchema = z.object({
  section: z.literal('global'),
  settings: z
    .array(z.object({ key: z.string().min(1), value: z.string().max(5000) }))
    .min(1),
});

const parseBooleanValue = (value: string) => {
  const normalised = value.trim().toLowerCase();
  if (normalised === 'true') return 'true';
  if (normalised === 'false') return 'false';
  return null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const section = request.nextUrl.searchParams.get('section')?.trim();
  if (!section) {
    return respond(400, { error: 'section is required (feature-flags or global).' });
  }

  if (section === 'feature-flags') {
    const { data, error } = await supabaseAdmin
      .from('platform_feature_flags')
      .select('key, enabled');
    if (error) return respond(500, { error: error.message });

    const enabledByKey = new Map((data ?? []).map((row) => [row.key, Boolean(row.enabled)]));
    return respond(200, {
      section,
      flags: FLAG_DEFINITIONS.map((flag) => ({
        ...flag,
        enabled: enabledByKey.has(flag.key) ? enabledByKey.get(flag.key) : flag.enabled,
      })),
      summary: {
        total: FLAG_DEFINITIONS.length,
        enabled: FLAG_DEFINITIONS.filter((flag) =>
          enabledByKey.has(flag.key) ? Boolean(enabledByKey.get(flag.key)) : flag.enabled
        ).length,
      },
    });
  }

  if (section === 'global') {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('key, value, value_type');
    if (error) return respond(500, { error: error.message });

    const valueByKey = new Map((data ?? []).map((row) => [row.key, { value: row.value, value_type: row.value_type }]));
    return respond(200, {
      section,
      settings: GLOBAL_SETTING_DEFINITIONS.map((setting) => {
        const stored = valueByKey.get(setting.key);
        return {
          ...setting,
          value: stored?.value ?? setting.value,
          type: stored?.value_type ?? setting.type,
        };
      }),
    });
  }

  if (section === 'roles') {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('key, value')
      .eq('key', 'role_permissions_v1')
      .maybeSingle();
    if (error) return respond(500, { error: error.message });

    if (data?.value) {
      try {
        const stored = JSON.parse(data.value) as unknown;
        if (Array.isArray(stored)) {
          return respond(200, { section, roles: stored });
        }
      } catch {
        // Fall through to defaults
      }
    }

    return respond(200, { section, roles: null });
  }

  return respond(400, { error: 'Invalid section. Use feature-flags, global, or roles.' });
}

const rolesUpdateSchema = z.object({
  section: z.literal('roles'),
  roles: z.array(z.object({
    role: z.string().min(1),
    label: z.string().min(1),
    description: z.string().max(1000),
    scopes: z.array(z.string().min(1)).min(1),
    color: z.string().min(1),
  })).min(1).max(20),
});

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsedFlags = featureFlagUpdateSchema.safeParse(body);
  if (parsedFlags.success) {
    const definitionByKey = new Map(FLAG_DEFINITIONS.map((flag) => [flag.key, flag]));
    const invalidKeys = parsedFlags.data.flags
      .map((flag) => flag.key)
      .filter((key) => !definitionByKey.has(key));

    if (invalidKeys.length > 0) {
      return respond(400, { error: `Unknown feature flag keys: ${invalidKeys.join(', ')}` });
    }

    const upsertRows = parsedFlags.data.flags.map((flag) => {
      const definition = definitionByKey.get(flag.key)!;
      return {
        key: definition.key,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        enabled: flag.enabled,
        updated_by: owner.id,
      };
    });

    const { error } = await supabaseAdmin
      .from('platform_feature_flags')
      .upsert(upsertRows, { onConflict: 'key' });

    if (error) return respond(500, { error: error.message });
    return respond(200, { success: true, updated: upsertRows.length });
  }

  const parsedSettings = globalSettingsUpdateSchema.safeParse(body);
  if (parsedSettings.success) {
    const definitionByKey = new Map(
      GLOBAL_SETTING_DEFINITIONS.map((setting) => [setting.key, setting])
    );
    const invalidKeys = parsedSettings.data.settings
      .map((setting) => setting.key)
      .filter((key) => !definitionByKey.has(key));
    if (invalidKeys.length > 0) {
      return respond(400, { error: `Unknown global setting keys: ${invalidKeys.join(', ')}` });
    }

    for (const setting of parsedSettings.data.settings) {
      const definition = definitionByKey.get(setting.key)!;
      const rawValue = setting.value.trim();
      if (definition.type === 'number' && !Number.isFinite(Number(rawValue))) {
        return respond(400, { error: `Setting '${setting.key}' must be a valid number.` });
      }
      if (definition.type === 'boolean' && parseBooleanValue(rawValue) === null) {
        return respond(400, { error: `Setting '${setting.key}' must be true or false.` });
      }
    }

    const upsertRows = parsedSettings.data.settings.map((setting) => {
      const definition = definitionByKey.get(setting.key)!;
      const rawValue = setting.value.trim();

      if (definition.type === 'boolean') {
        const parsedBoolean = parseBooleanValue(rawValue) as 'true' | 'false';
        return {
          key: definition.key,
          label: definition.label,
          value: parsedBoolean,
          value_type: definition.type,
          category: definition.category,
          updated_by: owner.id,
        };
      }

      return {
        key: definition.key,
        label: definition.label,
        value: rawValue,
        value_type: definition.type,
        category: definition.category,
        updated_by: owner.id,
      };
    });

    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert(upsertRows, { onConflict: 'key' });

    if (error) return respond(500, { error: error.message });
    return respond(200, { success: true, updated: upsertRows.length });
  }

  const parsedRoles = rolesUpdateSchema.safeParse(body);
  if (parsedRoles.success) {
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        key: 'role_permissions_v1',
        label: 'Role Permissions Matrix',
        value: JSON.stringify(parsedRoles.data.roles),
        value_type: 'text',
        category: 'Platform Identity',
        updated_by: owner.id,
      }, { onConflict: 'key' });

    if (error) return respond(500, { error: error.message });
    return respond(200, { success: true, roles: parsedRoles.data.roles.length });
  }

  return respond(400, {
    error:
      'Validation failed. Use section=feature-flags with flags[], section=global with settings[], or section=roles with roles[].',
  });
}
