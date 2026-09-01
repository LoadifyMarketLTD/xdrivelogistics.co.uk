// Company configuration for XDrive Logistics Ltd
// MASTER SPEC - ONE SOURCE OF TRUTH

export const COMPANY_CONFIG = {
  name: 'XDrive Logistics',
  legalName: 'XDrive Logistics Ltd',
  tagline: 'Move Freight. Manage Operations. Grow Your Network.',
  companyNumber: '13171804',

  // Physical / registered office address
  address: {
    street: '101 Cornelian Street',
    city: 'Blackburn',
    postcode: 'BB1 9QL',
    country: 'United Kingdom',
    full: '101 Cornelian Street, Blackburn, BB1 9QL, United Kingdom',
  },

  // Primary operational email
  email: 'contact@xdrivelogistics.co.uk',
  phone: '+447377694228',
  phoneDisplay: '07377 694 228',
  
  // WhatsApp
  whatsapp: {
    number: '447377694228',
    defaultMessage: "Hello, I'd like to inquire about your transport services",
  },
  
  // Payment configuration (MASTER SPEC)
  // Standard XDrive terms are 14 or 30 days from invoice date. Pay now remains
  // available for immediate-payment cases. A single +15 day extension is an
  // exceptional finance action and is stored separately from the base term.
  // Bank-transfer details are read from server-only env vars (no NEXT_PUBLIC_ prefix).
  // They must NEVER be embedded in client-side JavaScript bundles.
  // On the client these fields resolve to '' (empty string); the rendered values
  // come from the company_settings table fetched via authenticated API routes.
  payment: {
    bankTransfer: {
      accountName: process.env.COMPANY_BANK_ACCOUNT_NAME?.trim() || '',
      sortCode: process.env.COMPANY_BANK_SORT_CODE?.trim() || '',
      accountNumber: process.env.COMPANY_BANK_ACCOUNT_NUMBER?.trim() || '',
    },
    paypal: {
      email: process.env.COMPANY_PAYPAL_EMAIL?.trim() || '',
    },
    terms: ['Pay now', '14 days', '30 days'] as const,
    defaultTerm: '14 days' as const,
    specialExtensionDays: 15 as const,
    lateFeeNote: 'Late commercial payments may be subject to statutory interest and recovery-cost compensation where applicable.',
    lateFeeAmount: 'Statutory late-payment remedies apply only where legally and contractually applicable.',
  },
  
  // VAT options (MASTER SPEC)
  vat: {
    registrationNumber: 'GB 375949535',
    rates: [0, 5, 20] as const,
    defaultRate: 20,
  },
  
  // Invoice configuration (MASTER SPEC)
  invoice: {
    jobRefPrefix: 'DC',
    invoicePrefix: 'INV',
  },
  
  // Social media
  social: {
    facebook: '#',
    instagram: '#',
    tiktok: '#',
    youtube: '#',
    linkedin: '#',
  },
};

// Job status options (MASTER SPEC) — values match the Supabase public.job_status ENUM
// Canonical chain: draft → posted → quoted → awarded → allocated → collected
//                       → in_transit → delivered → invoiced → paid
export const JOB_STATUS = {
  RECEIVED:   'draft',
  POSTED:     'posted',
  QUOTED:     'quoted',
  AWARDED:    'awarded',
  ALLOCATED:  'allocated',
  COLLECTED:  'collected',
  IN_TRANSIT: 'in_transit',
  DELIVERED:  'delivered',
  INVOICED:   'invoiced',
  PAID:       'paid',
  CANCELLED:  'cancelled',
  DISPUTED:   'disputed',
} as const;

export const JOB_STATUS_LABEL: Record<string, string> = {
  draft:      'Received',
  posted:     'Posted',
  quoted:     'Quoted',
  awarded:    'Awarded',
  allocated:  'Allocated',
  collected:  'Collected',
  in_transit: 'In Transit',
  delivered:  'Delivered',
  invoiced:   'Invoiced',
  paid:       'Paid',
  cancelled:  'Cancelled',
  disputed:   'Disputed',
};

export const BID_STATUS = {
  SUBMITTED:  'submitted',
  ACCEPTED:   'accepted',
  REJECTED:   'rejected',
  WITHDRAWN:  'withdrawn',
} as const;

export const DELAY_OPTIONS = [15, 30, 45, 60] as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];
export type DelayOption = typeof DELAY_OPTIONS[number];
export type PaymentTerm = typeof COMPANY_CONFIG.payment.terms[number];
export type VATRate = typeof COMPANY_CONFIG.vat.rates[number];
