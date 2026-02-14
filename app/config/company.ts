// Company configuration for XDrive Logistics Ltd
// MASTER SPEC - ONE SOURCE OF TRUTH

export const COMPANY_CONFIG = {
  name: 'XDrive Logistics Ltd',
  tagline: 'Professional Transport Services',
  
  // Primary operational email
  email: 'xdrivelogisticsltd@gmail.com',
  phone: '+447423272138',
  phoneDisplay: '07423 272 138',
  
  // WhatsApp
  whatsapp: {
    number: '447423272138',
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
      email: 'xdrivelogisticsltd@gmail.com',
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
    jobRefPrefix: 'XD', // XDrive prefix
    invoicePrefix: 'INV',
  },
  
  // Social media
  social: {
    facebook: 'https://www.facebook.com/xdrivelogistics',
    instagram: 'https://www.instagram.com/xdrivelogistics',
    tiktok: 'https://www.tiktok.com/@xdrivelogistics',
    linkedin: '#', // Optional
  },
};

// Job status options (MASTER SPEC)
export const JOB_STATUS = {
  RECEIVED: 'Received',
  POSTED: 'Posted',
  ALLOCATED: 'Allocated',
  DELIVERED: 'Delivered',
} as const;

// Delay update options (MASTER SPEC)
export const DELAY_OPTIONS = [15, 30, 45, 60] as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];
export type DelayOption = typeof DELAY_OPTIONS[number];
export type PaymentTerm = typeof COMPANY_CONFIG.payment.terms[number];
export type VATRate = typeof COMPANY_CONFIG.vat.rates[number];
