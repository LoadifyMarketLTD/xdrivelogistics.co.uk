import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyCapabilityContext, requireCompanyCapability } from '../../admin/_lib/requireCompanyCapability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const text = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const SPECIALIST_CODES = [
  '24_hour',
  'adr',
  'dgsa_qualified',
  'fors_bronze',
  'fors_silver',
  'fors_gold',
  'frozen',
  'hanging_garment',
  'high_security',
  'installation_swapout',
  'aviation_level_ab',
  'cargo_operated_level_d',
  'refrigerated_chilled',
  'removals',
  'waste_carrier',
  'weee',
  'authorised_economic_operator',
  'cmr',
] as const;

const REGULATED_CODES = new Set<string>([
  'adr',
  'dgsa_qualified',
  'fors_bronze',
  'fors_silver',
  'fors_gold',
  'aviation_level_ab',
  'cargo_operated_level_d',
  'waste_carrier',
  'weee',
  'authorised_economic_operator',
]);

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  operatorLicenceNumber: z.string().max(120).optional().nullable(),
  financeEmail: z.string().max(320).optional().nullable(),
  secondaryPhone: z.string().max(80).optional().nullable(),
  emailVisibleToMembers: z.boolean(),
  homeLocation: z.string().max(240).optional().nullable(),
  directoryLocation: z.string().max(240).optional().nullable(),
  bookingFooter: z.string().max(2000).optional().nullable(),
  deliveryNoteCompanyName: z.string().max(200).optional().nullable(),
  deliveryNoteCustomerPhone: z.string().max(80).optional().nullable(),
  deliveryNoteDriverPhone: z.string().max(80).optional().nullable(),
  deliveryNoteFooter: z.string().max(2000).optional().nullable(),
  waitingTimeTerms: z.string().max(500).optional().nullable(),
  loadingTimeTerms: z.string().max(500).optional().nullable(),
  cancellationTerms: z.string().max(500).optional().nullable(),
  otherCharges: z.string().max(500).optional().nullable(),
  feedbackViewDays: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(180), z.literal(365)]),
  driverMustConfirmAcceptance: z.boolean(),
  allowLoadReminder: z.boolean(),
  showNotificationBar: z.boolean(),
  showAverageSpeedReplay: z.boolean(),
  acceptElectronicQuotes: z.boolean(),
  acceptQuotesApprovedMembersOnly: z.boolean(),
  acceptInternationalQuotes: z.boolean(),
  receiveQuoteEmailNotifications: z.boolean(),
  showFullPostcodePostedLoads: z.boolean(),
  specialistCapabilities: z.array(z.enum(SPECIALIST_CODES)).max(SPECIALIST_CODES.length),
});

type OperationsSettingsRow = {
  operator_licence_number?: string | null;
  finance_email?: string | null;
  secondary_phone?: string | null;
  email_visible_to_members?: boolean | null;
  home_location?: string | null;
  directory_location?: string | null;
  booking_footer?: string | null;
  delivery_note_company_name?: string | null;
  delivery_note_customer_phone?: string | null;
  delivery_note_driver_phone?: string | null;
  delivery_note_footer?: string | null;
  waiting_time_terms?: string | null;
  loading_time_terms?: string | null;
  cancellation_terms?: string | null;
  other_charges?: string | null;
  feedback_view_days?: number | null;
  driver_must_confirm_acceptance?: boolean | null;
  allow_load_reminder?: boolean | null;
  show_notification_bar?: boolean | null;
  show_average_speed_replay?: boolean | null;
  accept_electronic_quotes?: boolean | null;
  accept_quotes_approved_members_only?: boolean | null;
  accept_international_quotes?: boolean | null;
  receive_quote_email_notifications?: boolean | null;
  show_full_postcode_posted_loads?: boolean | null;
  updated_at?: string | null;
};

const SETTINGS_FIELDS = [
  'company_id',
  'operator_licence_number',
  'finance_email',
  'secondary_phone',
  'email_visible_to_members',
  'home_location',
  'directory_location',
  'booking_footer',
  'delivery_note_company_name',
  'delivery_note_customer_phone',
  'delivery_note_driver_phone',
  'delivery_note_footer',
  'waiting_time_terms',
  'loading_time_terms',
  'cancellation_terms',
  'other_charges',
  'feedback_view_days',
  'driver_must_confirm_acceptance',
  'allow_load_reminder',
  'show_notification_bar',
  'show_average_speed_replay',
  'accept_electronic_quotes',
  'accept_quotes_approved_members_only',
  'accept_international_quotes',
  'receive_quote_email_notifications',
  'show_full_postcode_posted_loads',
  'updated_at',
].join(',');

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const auth = await requireCompanyCapability(request, companyId, 'settings.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;

  const [settingsResult, capabilitiesResult] = await Promise.all([
    supabaseAdmin!.from('company_settings').select(SETTINGS_FIELDS).eq('company_id', companyId).maybeSingle(),
    supabaseAdmin!
      .from('company_specialist_capabilities')
      .select('capability_code,verification_required,verification_status,evidence_document_id,review_note,updated_at')
      .eq('company_id', companyId)
      .order('capability_code'),
  ]);

  if (settingsResult.error) return json(500, { error: 'Company operations settings could not be loaded.' });
  if (capabilitiesResult.error) return json(500, { error: 'Specialist capabilities could not be loaded.' });

  const row = (settingsResult.data ?? null) as unknown as OperationsSettingsRow | null;
  return json(200, {
    settings: {
      operatorLicenceNumber: row?.operator_licence_number ?? '',
      financeEmail: row?.finance_email ?? '',
      secondaryPhone: row?.secondary_phone ?? '',
      emailVisibleToMembers: row?.email_visible_to_members ?? false,
      homeLocation: row?.home_location ?? '',
      directoryLocation: row?.directory_location ?? '',
      bookingFooter: row?.booking_footer ?? '',
      deliveryNoteCompanyName: row?.delivery_note_company_name ?? '',
      deliveryNoteCustomerPhone: row?.delivery_note_customer_phone ?? '',
      deliveryNoteDriverPhone: row?.delivery_note_driver_phone ?? '',
      deliveryNoteFooter: row?.delivery_note_footer ?? '',
      waitingTimeTerms: row?.waiting_time_terms ?? '',
      loadingTimeTerms: row?.loading_time_terms ?? '',
      cancellationTerms: row?.cancellation_terms ?? '',
      otherCharges: row?.other_charges ?? '',
      feedbackViewDays: row?.feedback_view_days ?? 90,
      driverMustConfirmAcceptance: row?.driver_must_confirm_acceptance ?? true,
      allowLoadReminder: row?.allow_load_reminder ?? true,
      showNotificationBar: row?.show_notification_bar ?? true,
      showAverageSpeedReplay: row?.show_average_speed_replay ?? true,
      acceptElectronicQuotes: row?.accept_electronic_quotes ?? true,
      acceptQuotesApprovedMembersOnly: row?.accept_quotes_approved_members_only ?? false,
      acceptInternationalQuotes: row?.accept_international_quotes ?? true,
      receiveQuoteEmailNotifications: row?.receive_quote_email_notifications ?? true,
      showFullPostcodePostedLoads: row?.show_full_postcode_posted_loads ?? true,
      updatedAt: row?.updated_at ?? null,
    },
    specialistCapabilities: capabilitiesResult.data ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Invalid company operations settings payload.' });

  const auth = await requireCompanyCapability(request, parsed.data.companyId, 'settings.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;

  const cleanEmail = text(parsed.data.financeEmail, 320);
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return json(422, { error: 'Finance email is not valid.' });
  }

  const settingsValues = {
    company_id: parsed.data.companyId,
    operator_licence_number: text(parsed.data.operatorLicenceNumber, 120) || null,
    finance_email: cleanEmail || null,
    secondary_phone: text(parsed.data.secondaryPhone, 80) || null,
    email_visible_to_members: parsed.data.emailVisibleToMembers,
    home_location: text(parsed.data.homeLocation, 240) || null,
    directory_location: text(parsed.data.directoryLocation, 240) || null,
    booking_footer: text(parsed.data.bookingFooter, 2000) || null,
    delivery_note_company_name: text(parsed.data.deliveryNoteCompanyName, 200) || null,
    delivery_note_customer_phone: text(parsed.data.deliveryNoteCustomerPhone, 80) || null,
    delivery_note_driver_phone: text(parsed.data.deliveryNoteDriverPhone, 80) || null,
    delivery_note_footer: text(parsed.data.deliveryNoteFooter, 2000) || null,
    waiting_time_terms: text(parsed.data.waitingTimeTerms, 500) || null,
    loading_time_terms: text(parsed.data.loadingTimeTerms, 500) || null,
    cancellation_terms: text(parsed.data.cancellationTerms, 500) || null,
    other_charges: text(parsed.data.otherCharges, 500) || null,
    feedback_view_days: parsed.data.feedbackViewDays,
    driver_must_confirm_acceptance: parsed.data.driverMustConfirmAcceptance,
    allow_load_reminder: parsed.data.allowLoadReminder,
    show_notification_bar: parsed.data.showNotificationBar,
    show_average_speed_replay: parsed.data.showAverageSpeedReplay,
    accept_electronic_quotes: parsed.data.acceptElectronicQuotes,
    accept_quotes_approved_members_only: parsed.data.acceptQuotesApprovedMembersOnly,
    accept_international_quotes: parsed.data.acceptInternationalQuotes,
    receive_quote_email_notifications: parsed.data.receiveQuoteEmailNotifications,
    show_full_postcode_posted_loads: parsed.data.showFullPostcodePostedLoads,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };

  const { error: settingsError } = await supabaseAdmin!
    .from('company_settings')
    .upsert(settingsValues, { onConflict: 'company_id' });
  if (settingsError) return json(500, { error: 'Company operations settings could not be saved.' });

  const selected = new Set(parsed.data.specialistCapabilities);
  const { data: existing, error: existingError } = await supabaseAdmin!
    .from('company_specialist_capabilities')
    .select('id,capability_code,verification_status')
    .eq('company_id', parsed.data.companyId);
  if (existingError) return json(500, { error: 'Specialist capabilities could not be reconciled.' });

  const existingByCode = new Map((existing ?? []).map((row) => [String(row.capability_code), row]));
  const removeIds = (existing ?? [])
    .filter((row) => !selected.has(row.capability_code as typeof SPECIALIST_CODES[number]))
    .map((row) => row.id);

  if (removeIds.length) {
    const { error: deleteError } = await supabaseAdmin!
      .from('company_specialist_capabilities')
      .delete()
      .eq('company_id', parsed.data.companyId)
      .in('id', removeIds);
    if (deleteError) return json(500, { error: 'Removed specialist capabilities could not be saved.' });
  }

  for (const code of selected) {
    const previous = existingByCode.get(code);
    if (previous) continue;
    const verificationRequired = REGULATED_CODES.has(code);
    const { error: insertError } = await supabaseAdmin!
      .from('company_specialist_capabilities')
      .insert({
        company_id: parsed.data.companyId,
        capability_code: code,
        verification_required: verificationRequired,
        verification_status: verificationRequired ? 'pending' : 'declared',
        declared_by: auth.userId,
        declared_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    if (insertError) return json(500, { error: 'A specialist capability could not be saved.' });
  }

  return json(200, { ok: true });
}
