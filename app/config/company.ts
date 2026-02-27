// Company configuration for XDrive Logistics Ltd
// MASTER SPEC - ONE SOURCE OF TRUTH

export const COMPANY_CONFIG = {
  name: 'XDrive Logistics',
  legalName: 'XDrive Logistics Ltd',
  tagline: 'Professional Transport Services',
  companyNumber: '13171804',

  // Physical address
  address: {
    street: '101 Cornelian Street',
    city: 'Blackburn',
    postcode: 'BB1 9QL',
    country: 'United Kingdom',
    full: '101 Cornelian Street, Blackburn, BB1 9QL, United Kingdom',
  },

  // Primary operational email
  email: 'dannycourierltd@gmail.com',
  phone: '+447377694228',
  phoneDisplay: '07377 694 228',
  
  // WhatsApp
  whatsapp: {
    number: '447377694228',
    defaultMessage: "Hello, I'd like to inquire about your transport services",
  },
  
  // Payment configuration (MASTER SPEC)
  payment: {
    bankTransfer: {
      accountName: 'XDrive Logistics Ltd',
      sortCode: '04-00-04', // PLACEHOLDER - replace in production
      accountNumber: '12345678', // PLACEHOLDER - replace in production
    },
    paypal: {
      email: 'dannycourierltd@gmail.com',
    },
    terms: ['Pay now', '14 days', '30 days'] as const,
    lateFeeNote: 'Late payments may incur administrative charges.',
    lateFeeAmount: 'A late payment charge of £25 per full week may apply after the due date.',
  },
  
  // VAT options (MASTER SPEC)
  vat: {
    rates: [0, 5, 20] as const,
    defaultRate: 20,
  },
  
  // Invoice configuration (MASTER SPEC)
  invoice: {
    jobRefPrefix: 'DC', // job reference prefix
    invoicePrefix: 'INV',
  },
  
  // Social media
  social: {
    facebook: '#',
    instagram: '#',
    tiktok: '#',
    linkedin: '#', // Optional
  },
};

// Job status options (MASTER SPEC) — values match the Supabase public.job_status ENUM
export const JOB_STATUS = {
  RECEIVED: 'draft',       // new job awaiting posting
  POSTED: 'posted',        // posted for driver bids
  ALLOCATED: 'allocated',  // driver assigned
  DELIVERED: 'delivered',  // job completed
} as const;

// Human-readable labels for each DB status value
export const JOB_STATUS_LABEL: Record<string, string> = {
  draft: 'Received',
  posted: 'Posted',
  allocated: 'Allocated',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

// Delay update options (MASTER SPEC)
export const DELAY_OPTIONS = [15, 30, 45, 60] as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];
export type DelayOption = typeof DELAY_OPTIONS[number];
export type PaymentTerm = typeof COMPANY_CONFIG.payment.terms[number];
export type VATRate = typeof COMPANY_CONFIG.vat.rates[number];
