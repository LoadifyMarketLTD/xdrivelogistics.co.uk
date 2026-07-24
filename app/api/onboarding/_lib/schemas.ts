import { z } from 'zod';

export const onboardingPatchBaseSchema = z
  .object({
    currentStep: z.string().trim().min(1).max(120).optional(),
    completionPercentage: z.number().min(0).max(100).optional(),
    status: z.enum(['draft', 'in_progress', 'request_changes']).optional(),
  })
  .strict();

// Onboarding payloads legitimately contain uploaded-document markers such as
// doc_driving_licence and legacy aliases retained while an applicant resumes.
// Known business fields are still validated, while those persisted metadata
// keys are preserved instead of causing the entire PATCH/submit to fail.
export const customerPayloadSchema = z
  .object({
    full_name: z.string().trim().min(1),
    contact_email: z.string().trim().email(),
    contact_phone: z.string().trim().min(1).optional().default(''),
    company_name: z.string().trim().optional().default(''),
    billing_address: z.string().trim().optional().default(''),
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
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const driverIdentityRecordSchema = z.record(z.string(), z.unknown());

// Individual drivers do not create a carrier company or provide owner-operator
// vehicle/business details. Compliance still reviews identity and right-to-work
// evidence, while passthrough document markers are preserved.
export const individualDriverPayloadSchema = driverIdentityRecordSchema.superRefine((payload, context) => {
  for (const key of ['full_name', 'address', 'phone', 'email']) {
    const value = payload[key];
    if (typeof value !== 'string' || !value.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key.replace(/_/g, ' ')} is required.`,
      });
    }
  }

  const email = payload.email;
  if (typeof email === 'string' && email.trim() && !z.string().email().safeParse(email.trim()).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'A valid email is required.' });
  }
});

// Owner-driver applications are reviewed by compliance after submission.
// The API must preserve every field/document marker and must not block a real
// applicant because a free-text vehicle or immigration field uses a different
// format. Database submission remains authenticated and company-scoped.
const ownerDriverRecordSchema = z.record(z.string(), z.unknown());
export const ownerDriverPayloadSchema = ownerDriverRecordSchema;

export const customerPatchSchema = onboardingPatchBaseSchema.extend({
  payload: customerPayloadSchema.partial().optional(),
});

export const brokerPatchSchema = onboardingPatchBaseSchema.extend({
  payload: brokerPayloadSchema.partial().optional(),
});

export const fleetPatchSchema = onboardingPatchBaseSchema.extend({
  payload: fleetPayloadSchema.partial().optional(),
});

export const individualDriverPatchSchema = onboardingPatchBaseSchema.extend({
  payload: driverIdentityRecordSchema.optional(),
});

export const ownerDriverPatchSchema = onboardingPatchBaseSchema.extend({
  payload: ownerDriverRecordSchema.optional(),
});

export type CustomerPayload = z.infer<typeof customerPayloadSchema>;
export type BrokerPayload = z.infer<typeof brokerPayloadSchema>;
export type FleetPayload = z.infer<typeof fleetPayloadSchema>;
export type IndividualDriverPayload = z.infer<typeof individualDriverPayloadSchema>;
export type OwnerDriverPayload = z.infer<typeof ownerDriverPayloadSchema>;

export const parseOwnerDriverDate = (value: string) => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) throw new Error('Invalid owner-driver date.');
  return normalized;
};