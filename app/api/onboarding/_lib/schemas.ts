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

const shareCodeRegex = /^[A-Za-z0-9]{9}$/;

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

const ownerDriverPayloadBaseSchema = z
  .object({
    full_name: z.string().trim().min(1),
    dob: z.string().trim().min(1),
    nationality: z.string().trim().min(1),
    address: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.string().trim().email(),
    right_to_work_status: z.enum(['citizen', 'visa_required', 'share_code_required', 'settled', 'pre_settled', 'other']),
    visa_type: z.string().trim().optional().default(''),
    visa_expiry: z.string().trim().optional().default(''),
    share_code: z.string().trim().optional().default(''),
    settled_status: z.boolean(),
    pre_settled_status: z.boolean(),
    registration: z.string().trim().min(1),
    make: z.string().trim().min(1),
    model: z.string().trim().min(1),
    payload: z.string().trim().min(1),
    dimensions: z.string().trim().optional().default(''),
    tail_lift: z.string().trim().optional().default(''),
    insurance_details: z.string().trim().optional().default(''),
  })
  .passthrough();

export const ownerDriverPayloadSchema = ownerDriverPayloadBaseSchema.superRefine((value, ctx) => {
  const visaRequired = value.right_to_work_status === 'visa_required' || value.right_to_work_status === 'share_code_required';

  if (visaRequired && !value.visa_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['visa_type'],
      message: 'Visa type is required when visa checks apply.',
    });
  }

  if (visaRequired && !value.visa_expiry) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['visa_expiry'],
      message: 'Visa expiry is required when visa checks apply.',
    });
  }

  if (value.visa_expiry) {
    const normalizedExpiry = normalizeDateOnly(value.visa_expiry);
    const expiryTime = normalizedExpiry ? new Date(`${normalizedExpiry}T00:00:00.000Z`).getTime() : Number.NaN;
    if (!normalizedExpiry || Number.isNaN(expiryTime) || expiryTime <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['visa_expiry'],
        message: 'Visa expiry must be a valid future date (YYYY-MM-DD or DD/MM/YYYY).',
      });
    }
  }

  if (visaRequired && !value.share_code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['share_code'],
      message: 'Share code is required when visa checks apply.',
    });
  }

  if (value.share_code && !shareCodeRegex.test(value.share_code)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['share_code'],
      message: 'Share code must be 9 alphanumeric characters.',
    });
  }
});

export const customerPatchSchema = onboardingPatchBaseSchema.extend({
  payload: customerPayloadSchema.partial().optional(),
});

export const brokerPatchSchema = onboardingPatchBaseSchema.extend({
  payload: brokerPayloadSchema.partial().optional(),
});

export const fleetPatchSchema = onboardingPatchBaseSchema.extend({
  payload: fleetPayloadSchema.partial().optional(),
});

export const ownerDriverPatchSchema = onboardingPatchBaseSchema.extend({
  payload: ownerDriverPayloadBaseSchema.partial().optional(),
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
