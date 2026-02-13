// Company configuration for Danny Courier Ltd
// TODO: Move sensitive data to environment variables in production

export const COMPANY_CONFIG = {
  name: 'Danny Courier Ltd',
  tagline: 'Professional Courier Services',
  email: 'info@dannycourier.co.uk',
  
  // TODO: Replace with actual bank details in production
  // These are PLACEHOLDER values for development only
  payment: {
    bankTransfer: {
      accountName: 'Danny Courier Ltd',
      sortCode: '04-00-04',
      accountNumber: '12345678',
    },
    paypal: {
      email: 'xdrivelogisticsltd@gmail.com',
    },
  },
  
  // Invoice configuration
  invoice: {
    paymentTerms: ['14 days', '30 days'] as const,
    lateFeeNote: 'Late fee: £25 per full week overdue after due date',
    jobRefPrefix: 'DC', // Danny Courier
    invoicePrefix: 'INV',
  },
};
