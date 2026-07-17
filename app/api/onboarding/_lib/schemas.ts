import { z } from 'zod';

export const onboardingPatchBaseSchema = z
  .object({
    currentStep: z.string().trim().min(1).max(120).optional(),
    completionPercentage: z.number().min(0).max(100).optional(),
    status: z.enum(['draft', 'in_progress', 'request_changes']).optional(),
  })
  .strict();


export const customerPayloadSchema = z
  .object({
    full_name: z.string().trim().min(1),
    contact_email: z.string().trim().email(),
    contact_phone: z.string().trim().min(1).optional().default(''),
    company_name: z.string().trim().optional().default(''),
    billing_address: z.string().trim().optional().default(''),
  })
  .strict();
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
  .strict();

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
  .strict();

const shareCodeRegex = /^[A-Za-z0-9]{9}$/;

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
    dimensions: z.string().trim().min(1),
  })
  .strict();

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
      const expiryDate = new Date(`${value.visa_expiry}T00:00:00.000Z`);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['visa_expiry'],
          message: 'Visa expiry must be a future date.',
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

export const parseOwnerDriverDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10);
