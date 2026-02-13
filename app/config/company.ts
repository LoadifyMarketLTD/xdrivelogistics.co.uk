// Company configuration for Danny Courier Ltd
// TODO: Move sensitive data to environment variables in production

export const COMPANY_CONFIG = {
  name: 'Danny Courier Ltd',
  tagline: 'Professional Courier Services',
  
  // NOTE: Primary operational email is xdrivelogisticsltd@gmail.com as per business requirements
  // This email is used for quotes, bookings, and customer communication
  email: 'xdrivelogisticsltd@gmail.com',
  
  // TODO: Replace with actual bank details in production
  // These are PLACEHOLDER values for development only
  // NEVER commit real bank account details to the repository
  payment: {
    bankTransfer: {
      accountName: 'Danny Courier Ltd',
      sortCode: '04-00-04', // PLACEHOLDER
      accountNumber: '12345678', // PLACEHOLDER
    },
    paypal: {
      email: 'xdrivelogisticsltd@gmail.com', // Business PayPal account
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
