import { z } from 'zod';

export const onboardingPatchBaseSchema = z
  .object({
    currentStep: z.string().trim().min(1).max(120).optional(),
    completionPercentage: z.number().min(0).max(100).optional(),
    status: z.enum(['draft', 'in_progress', 'request_changes']).optional(),
  })
  .strict();

const normalizeDateOnly = (rawValue: string): string | null => {
  const value = rawValue.trim();
  if (!value) return '';

  let year: number;
  let month: number;
  let day: number;
  const yearFirst = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const dayFirst = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (yearFirst) {
    year = Number(yearFirst[1]);
    month = Number(yearFirst[2]);
    day = Number(yearFirst[3]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = Number(dayFirst[2]);
    year = Number(dayFirst[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const requiredDateOnly = z.string().trim().min(1).refine(
  (value) => Boolean(normalizeDateOnly(value)),
  'Enter a valid date.'
);

const optionalText = z.string().trim().optional().default('');

export const customerPayloadSchema = z
  .object({
    full_name: z.string().trim().min(1),
    contact_email: z.string().trim().email(),
    contact_phone: optionalText,
    company_name: optionalText,
    billing_address: optionalText,
  })
  .passthrough();

export const brokerPayloadSchema = z
  .object({
    company_name: z.string().trim().min(1),
    trading_name: z.string().trim().min(1),
    company_number: z.string().trim().min(1),
    vat_number: z.string().trim().min(1),
    billing_address: z.string().trim().min(1),
    trading_address: z.string().trim().min(1),
    contact_person: z.string().trim().min(1),
    finance_contact: z.string().trim().min(1),
    contact_email: z.string().trim().email(),
    contact_phone: z.string().trim().min(1),
  })
  .passthrough();

export const fleetPayloadSchema = z
  .object({
    legal_company_name: z.string().trim().min(1),
    trading_name: z.string().trim().min(1),
    company_number: z.string().trim().min(1),
    vat_number: z.string().trim().min(1),
    registered_address: z.string().trim().min(1),
    trading_address: z.string().trim().min(1),
    contact_person: z.string().trim().min(1),
    compliance_contact: z.string().trim().min(1),
    transport_contact: z.string().trim().min(1),
  })
  .passthrough();

export const ownerDriverPayloadSchema = z
  .object({
    full_name: z.string().trim().min(1),
    date_of_birth: requiredDateOnly,
    address: z.string().trim().min(1),
    contact_phone: z.string().trim().min(1),
    contact_email: z.string().trim().email(),
    national_insurance_number: z.string().trim().min(1),
    right_to_work_status: z.string().trim().min(1),
    licence_number: z.string().trim().min(1),
    licence_expiry: requiredDateOnly,
    registration: z.string().trim().min(1),
    make: z.string().trim().min(1),
    model: z.string().trim().min(1),
    payload: z.string().trim().min(1),
    dimensions: z.string().trim().min(1),
    nationality: optionalText,
    visa_expiry: optionalText,
    visa_type: optionalText,
    share_code: optionalText,
    settled_status: z.boolean().optional().default(false),
    pre_settled_status: z.boolean().optional().default(false),
    tail_lift: optionalText,
    insurance_details: optionalText,
  })
  .passthrough();

const draftText = z.string().max(5000);

const customerDraftPayloadSchema = z.object({
  full_name: draftText.optional(),
  contact_email: draftText.optional(),
  contact_phone: draftText.optional(),
  company_name: draftText.optional(),
  billing_address: draftText.optional(),
}).passthrough();

const brokerDraftPayloadSchema = z.object({
  company_name: draftText.optional(),
  trading_name: draftText.optional(),
  company_number: draftText.optional(),
  vat_number: draftText.optional(),
  billing_address: draftText.optional(),
  trading_address: draftText.optional(),
  contact_person: draftText.optional(),
  finance_contact: draftText.optional(),
  contact_email: draftText.optional(),
  contact_phone: draftText.optional(),
}).passthrough();

const fleetDraftPayloadSchema = z.object({
  legal_company_name: draftText.optional(),
  trading_name: draftText.optional(),
  company_number: draftText.optional(),
  vat_number: draftText.optional(),
  registered_address: draftText.optional(),
  trading_address: draftText.optional(),
  contact_person: draftText.optional(),
  compliance_contact: draftText.optional(),
  transport_contact: draftText.optional(),
}).passthrough();

const ownerDriverDraftPayloadSchema = z.object({
  full_name: draftText.optional(),
  date_of_birth: draftText.optional(),
  address: draftText.optional(),
  contact_phone: draftText.optional(),
  contact_email: draftText.optional(),
  national_insurance_number: draftText.optional(),
  right_to_work_status: draftText.optional(),
  licence_number: draftText.optional(),
  licence_expiry: draftText.optional(),
  registration: draftText.optional(),
  make: draftText.optional(),
  model: draftText.optional(),
  payload: draftText.optional(),
  dimensions: draftText.optional(),
  nationality: draftText.optional(),
  visa_expiry: draftText.optional(),
  visa_type: draftText.optional(),
  share_code: draftText.optional(),
  settled_status: z.boolean().optional(),
  pre_settled_status: z.boolean().optional(),
  tail_lift: draftText.optional(),
  insurance_details: draftText.optional(),
}).passthrough();

export const customerPatchSchema = onboardingPatchBaseSchema.extend({
  payload: customerDraftPayloadSchema.optional(),
});
export const brokerPatchSchema = onboardingPatchBaseSchema.extend({
  payload: brokerDraftPayloadSchema.optional(),
});
export const fleetPatchSchema = onboardingPatchBaseSchema.extend({
  payload: fleetDraftPayloadSchema.optional(),
});
export const ownerDriverPatchSchema = onboardingPatchBaseSchema.extend({
  payload: ownerDriverDraftPayloadSchema.optional(),
});

export type CustomerPayload = z.infer<typeof customerPayloadSchema>;
export type BrokerPayload = z.infer<typeof brokerPayloadSchema>;
export type FleetPayload = z.infer<typeof fleetPayloadSchema>;
export type OwnerDriverPayload = z.infer<typeof ownerDriverPayloadSchema>;

export const parseOwnerDriverDate = (value: string) => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) throw new Error('Invalid owner-driver date.');
  return normalized;
};
