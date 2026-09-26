export type RoleTradingTermsCode =
  | 'customer_shipper_terms'
  | 'broker_terms'
  | 'owner_driver_terms'
  | 'carrier_fleet_terms';

export type RoleTradingTermsDocument = {
  code: RoleTradingTermsCode;
  title: string;
  shortTitle: string;
  href: string;
  version: string;
  lastUpdated: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
};

const commonEnding = [
  { title: 'Records and audit trail', body: 'XDrive may retain booking states, messages, timestamps, evidence, POD, invoices, payment-status records, amendments and dispute records to operate the service, maintain an audit trail and meet applicable legal or contractual obligations.' },
  { title: 'Relationship with the Platform Terms', body: 'These role-specific terms supplement the XDrive Platform Terms, Membership & Subscription Terms and other policies expressly incorporated into the account. If a provision here addresses the role-specific transport relationship more specifically, it applies to that role-specific issue.' },
  { title: 'Governing law', body: 'These terms are governed by the law of England and Wales. For business users, the courts of England and Wales have exclusive jurisdiction, subject to any mandatory rule that applies otherwise.' },
] as const;

export const ROLE_TRADING_TERMS: Record<RoleTradingTermsCode, RoleTradingTermsDocument> = {
  customer_shipper_terms: {
    code: 'customer_shipper_terms',
    title: 'Customer / Shipper Trading Terms',
    shortTitle: 'Customer / Shipper Terms',
    href: '/legal/customer-shipper-terms',
    version: '2026-09-26-r2',
    lastUpdated: '26 September 2026',
    intro: 'These terms apply when a customer or shipper uses XDrive to request, award and manage transport services supplied by an independent carrier or owner driver.',
    sections: [
      { title: 'Business capacity and authority', body: 'You use XDrive in a business capacity and must be authorised to create transport requests, provide shipment information, award transport work and bind the business or organisation you represent.' },
      { title: 'Accurate transport requirements', body: 'You must provide accurate collection and delivery information, contacts, time windows, cargo description, quantity, weight, dimensions, value, vehicle requirements, loading requirements, references and any lawful special handling instructions that are relevant to the job.' },
      { title: 'Award and carrier acceptance', body: 'Selecting a carrier quote creates an award pending the carrier’s explicit acceptance. The booking is not treated as finally accepted until the carrier accepts the final booking terms through the applicable XDrive workflow.' },
      { title: 'Payment responsibility', body: 'Where your business is identified as the transport buyer or ordering party, your business is responsible for paying the performing carrier according to the accepted booking price, VAT treatment, payment terms, due date and any approved adjustments. XDrive does not assume that payment obligation merely because the booking is managed on the platform.' },
      { title: 'Per-award payment acknowledgement', body: 'Each time you award a carrier quote as transport buyer, an authorised user must separately confirm the company payment obligation for that booking. XDrive records the acknowledgement with the actor, timestamp and applicable terms version.' },
      { title: 'Buyer risk and exposure controls', body: 'XDrive may restrict Publish or Award when transport-buyer risk limits would be exceeded. New buyers are currently restricted by default to up to 3 active transport commitments and £2,500 outstanding transport exposure unless reviewed or overridden by an authorised Platform Owner. Restrictions do not cancel existing payment obligations.' },
      { title: 'Changes and additional charges', body: 'A material change to price, route, timing, cargo, payment terms or other agreed commercial terms must be recorded through the applicable amendment or adjustment workflow. Waiting time, handball, redelivery or other extras do not silently replace the original agreed price.' },
      { title: 'Collection, delivery and evidence', body: 'You must ensure reasonable access and accurate contact information at collection and delivery. POD, photographs, signatures and other operational evidence may be captured by the carrier or driver and stored against the booking.' },
      { title: 'Invoices, payment status and disputes', body: 'Invoices and payment-status records are linked to the booking. A genuine dispute should be raised through the available dispute process with the relevant evidence; passive non-approval of POD does not by itself rewrite the agreed payment terms or due date.' },
      ...commonEnding,
    ],
  },
  broker_terms: {
    code: 'broker_terms',
    title: 'Transport Broker Trading Terms',
    shortTitle: 'Broker Trading Terms',
    href: '/legal/broker-terms',
    version: '2026-09-26-r2',
    lastUpdated: '26 September 2026',
    intro: 'These terms apply when a transport broker or freight intermediary uses XDrive to source, award and manage transport capacity for its own business or on behalf of customers.',
    sections: [
      { title: 'Authority and commercial role', body: 'You must be authorised to submit and manage the transport requirements you place on XDrive. You are responsible for accurately identifying the commercial parties and for not misrepresenting whether you act as ordering party, intermediary, customer representative or another disclosed business role.' },
      { title: 'Customer and load information', body: 'You must pass through accurate collection, delivery, cargo, timing, vehicle, access, reference and handling information that the carrier reasonably needs to price and perform the transport service.' },
      { title: 'Award and carrier acceptance', body: 'A broker award selects the intended carrier but remains pending until the carrier explicitly accepts the final booking terms. Only then is the transport booking treated as accepted through XDrive.' },
      { title: 'Payment responsibility', body: 'If your brokerage business is identified as the transport buyer or ordering party for the carrier service, your brokerage business is responsible for paying the performing carrier according to the accepted commercial terms. A separate commercial arrangement between you and your customer does not transfer that carrier payment obligation unless the booking record lawfully identifies another payer and the carrier accepts that arrangement.' },
      { title: 'Per-award payment acknowledgement', body: 'Each time the brokerage awards a carrier quote as transport buyer, an authorised user must separately confirm the brokerage payment obligation for that booking. XDrive records the acknowledgement with the actor, timestamp and applicable terms version.' },
      { title: 'Buyer risk and exposure controls', body: 'XDrive may restrict Publish or Award when transport-buyer risk limits would be exceeded. New buyers are currently restricted by default to up to 3 active transport commitments and £2,500 outstanding transport exposure unless reviewed or overridden by an authorised Platform Owner.' },
      { title: 'Margins and customer arrangements', body: 'Any margin, resale price or separate customer-facing commercial arrangement is your responsibility and remains distinct from the immutable carrier rate and carrier payment terms recorded for the transport booking.' },
      { title: 'Amendments, extras and disputes', body: 'Changes to the carrier agreement and approved extras must be recorded through the platform workflow. You must not retrospectively alter the original carrier price, evidence or due date to reflect a separate customer dispute or margin adjustment.' },
      ...commonEnding,
    ],
  },
  owner_driver_terms: {
    code: 'owner_driver_terms',
    title: 'Owner Driver / Carrier Terms',
    shortTitle: 'Owner Driver / Carrier Terms',
    href: '/legal/owner-driver-terms',
    version: '2026-09-26-r2',
    lastUpdated: '26 September 2026',
    intro: 'These terms apply when an owner driver or self-employed carrier quotes for, accepts and performs transport work through XDrive.',
    sections: [
      { title: 'Business status and authority', body: 'You use XDrive in a business capacity and are responsible for the accuracy of the identity, business, tax, vehicle, insurance and compliance information supplied for your account.' },
      { title: 'Vehicle and legal compliance', body: 'You must use a vehicle and operating arrangement that are lawful and suitable for the accepted job and must hold the licences, insurance, qualifications, operator permissions and other documents legally required for the work you undertake.' },
      { title: 'Quotes and booking acceptance', body: 'Your quote is an offer to perform the described transport work at the quoted price and conditions. A buyer award does not become your accepted booking until you review and explicitly accept the final booking terms presented to you.' },
      { title: 'Performance of the transport service', body: 'Once accepted, you are responsible for performing the transport service in accordance with the booking, communicating material delays or problems, protecting the goods while in your custody and following lawful collection, delivery and evidence requirements.' },
      { title: 'Evidence and POD', body: 'You must provide accurate collection and delivery evidence where required, including photographs, recipient details, signatures, notes or documents. Evidence must not be fabricated, reused from another job or materially altered to misrepresent performance.' },
      { title: 'Collection handover evidence', body: 'Before a job is marked Loaded, XDrive may require a verified collection handover and at least one collection photograph, with up to 10 collection photographs linked to that handover.' },
      { title: 'Invoices and payment', body: 'Your invoice and payment claim must reflect the accepted carrier rate, VAT treatment where applicable, approved commercial adjustments and agreed payment terms. XDrive tracks the record but does not itself become the payer unless it separately contracts in writing to do so.' },
      { title: 'Waiting time and extras', body: 'Waiting time, handball, redelivery, additional stops or other extras must be proposed and approved through the applicable workflow where approval is required. They remain separate audited adjustments and do not overwrite the base carrier price.' },
      ...commonEnding,
    ],
  },
  carrier_fleet_terms: {
    code: 'carrier_fleet_terms',
    title: 'Carrier / Fleet Trading Terms',
    shortTitle: 'Carrier / Fleet Terms',
    href: '/legal/carrier-fleet-terms',
    version: '2026-09-26-r2',
    lastUpdated: '26 September 2026',
    intro: 'These terms apply when a carrier or fleet operator quotes for, accepts, allocates and performs transport work through XDrive using its business, vehicles and drivers.',
    sections: [
      { title: 'Company authority and responsibility', body: 'The account must be operated by authorised personnel. The carrier business is responsible for the drivers, vehicles, insurance, operating permissions and compliance information it provides or relies on to perform accepted transport work.' },
      { title: 'Quotes and commercial authority', body: 'Quotes submitted through the carrier account must be authorised and commercially accurate. A buyer award remains pending until an authorised carrier user explicitly accepts the final booking terms.' },
      { title: 'Allocation of drivers and vehicles', body: 'After carrier acceptance, the carrier is responsible for allocating an eligible driver and suitable vehicle where the booking requires allocation. Internal allocation does not change the carrier’s commercial obligations to the transport buyer.' },
      { title: 'Operational performance', body: 'The carrier must ensure that its assigned personnel follow the accepted route, timings, cargo and handling requirements, communicate material exceptions and provide the evidence reasonably required to document collection and delivery.' },
      { title: 'Invoices and payment', body: 'Carrier invoices must correspond to the accepted commercial agreement and any separately approved adjustments. The payer identified in the booking remains responsible according to the recorded payment terms; XDrive’s platform role does not transfer that obligation to XDrive.' },
      { title: 'Subcontracting and onward allocation', body: 'The carrier must not misrepresent who is performing the work. Where subcontracting is permitted and used, the carrier must comply with the applicable booking, disclosure, insurance and legal requirements and remains responsible for its own contractual commitments unless the parties expressly agree otherwise.' },
      { title: 'Evidence, amendments and disputes', body: 'POD, collection evidence, amendments, extras and dispute records must remain traceable to the booking. The carrier must not overwrite historical evidence or the original commercial agreement to resolve a later operational or payment issue.' },
      { title: 'Collection handover evidence', body: 'Before a job is marked Loaded, XDrive may require a verified collection handover and at least one collection photograph, with up to 10 collection photographs linked to that handover.' },
      { title: 'Buyer risk when acting as transport buyer', body: 'If the carrier or fleet account posts or awards work as transport buyer, XDrive may apply the same transport-buyer risk controls. New buyers are currently restricted by default to up to 3 active commitments and £2,500 outstanding transport exposure unless reviewed or overridden by an authorised Platform Owner.' },
      ...commonEnding,
    ],
  },
};

export const getRoleTradingTerms = (code: RoleTradingTermsCode) => ROLE_TRADING_TERMS[code];
