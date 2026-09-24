export const DEFAULT_INVOICE_EMAIL_SUBJECT = 'Invoice from [[My company]] - Load: [[Load ID]]';

export const DEFAULT_INVOICE_EMAIL_MESSAGE = `Dear [[Customer company]],

I am attaching Invoice [[Invoice number]] for Load [[Load ID]].

Details:
Late commercial payments may be subject to statutory interest and recovery-cost compensation where applicable.

Invoice: [[Invoice number]]
Date: [[Invoice date]]
Amount Due: [[Currency symbol]][[Gross total]]
Load: [[Load ID]]
Supplier: [[My company]]

Please let us know if you have any questions.

All the best,
[[My company]]`;

export const INVOICE_EMAIL_TOKENS = [
  'My company',
  'Customer company',
  'Invoice number',
  'Invoice date',
  'Currency symbol',
  'Gross total',
  'Load ID',
] as const;
