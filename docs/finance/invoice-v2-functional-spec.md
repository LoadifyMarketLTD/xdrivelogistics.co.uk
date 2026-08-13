# XDrive Invoice V2 — Final Functional Specification

Status: canonical implementation contract
Scope: platform invoicing for Fleet/Carrier companies and Owner Drivers
Visual reference: approved XDrive invoice/POD layout
Functional reference: Courier Exchange invoice workflow and the XDrive job lifecycle

## 1. Core principle

XDrive Invoice V2 is a multi-tenant invoicing engine. XDrive Logistics Ltd is one tenant using that engine; no XDrive Logistics legal, VAT, banking or numbering data may be hardcoded into shared invoice logic.

Every invoice must derive its issuer data from the invoicing Fleet/Carrier/Owner Driver entity and snapshot those values when the invoice is issued.

## 2. Job-first invoicing

For marketplace/direct XDrive jobs, an invoice is the financial completion document of a real job, not an independent finance record.

Canonical relationship:

Customer/Broker -> Job -> Commercial Agreement -> Fleet/Owner Driver -> Assigned Driver -> Vehicle -> Execution -> POD -> Delivered -> Invoice Draft -> Issued/Sent -> Payment/Credit Note

Marketplace invoices must retain both:

- a live relational link to the job (`invoice.job_id`), and
- immutable invoice snapshots of the job, parties, POD and financial values used at issue time.

## 3. Debtor / Bill-To rule

The invoice debtor is the company that directly contracted/awarded the transport to the invoicing Fleet/Owner Driver.

- Broker awards job -> Fleet invoices Broker.
- Customer awards job -> Fleet invoices Customer.
- The physical delivery recipient/end customer does not determine the invoice debtor.

The marketplace commercial agreement remains the source of truth for `buyer_company_id` and `supplier_company_id`.

## 4. POD is mandatory

There is no completed XDrive job without POD.

Hard rule:

`NO POD = NO DELIVERED = NO COMPLETED JOB = NO FINAL INVOICE`

The driver who executes the job must capture POD in the driver mobile application. Operational POD must never be fabricated, replaced or uploaded from the invoice editor.

Required server-side POD provenance includes, where captured:

- recipient name,
- signature,
- delivery photos,
- POD documents,
- delivery notes,
- left-at/location-of-handover,
- POD generated timestamp,
- driver/user provenance,
- delivered timestamp.

Every final job invoice must include a POD evidence section. The layout may adapt to the number of real evidence assets, but the POD section does not disappear for a completed XDrive job.

## 5. Automatic Draft, manual financial review

After server-side transition to `Delivered` with valid POD, XDrive automatically creates an Invoice Draft for the supplier Fleet/Owner Driver.

Auto-generated does not mean auto-issued.

The Draft is editable by authorised supplier finance users before issue. It starts with the accepted transport price and job/POD snapshot, then may receive legitimate additional invoice lines such as:

- Waiting time
- ULEZ
- Congestion charge
- Parking
- Tolls
- Ferry charge
- Extra mileage
- Additional stop
- Two-man crew
- Re-delivery
- Failed collection
- Cancellation charge
- Re-charge
- Late payment charge
- Miscellaneous/custom approved charge

The accepted transport price must not be silently overwritten. Additional money is represented as additional invoice lines with provenance/audit metadata.

Example:

- Delivery charge (accepted commercial agreement): GBP 150.00
- Waiting time: GBP 30.00
- Additional handling: GBP 10.00

The system must be able to explain why invoice total differs from the original accepted quote.

## 6. Invoice line model

Invoice V2 must support multiple line items.

Each line contains at minimum:

- quantity,
- item type,
- description,
- optional public line comment,
- unit price,
- net amount,
- VAT treatment,
- VAT rate,
- VAT amount,
- gross amount,
- source type,
- source reference/metadata,
- sort order,
- creator and timestamps.

The accepted commercial agreement produces a protected base line. Extra lines can be added while the invoice is Draft.

Negative invoices are not allowed. Reductions after issue use Credit Notes.

## 7. VAT engine

VAT treatment and numeric rate are separate concepts.

Canonical treatments:

- `standard` — normally 20%
- `reduced` — normally 5%
- `zero_rated` — 0%
- `exempt`
- `outside_scope`
- `reverse_charge`
- `not_registered`

The system must distinguish zero-rated VAT from exempt, outside-scope and supplier-not-VAT-registered supplies.

VAT is stored per invoice line. An invoice may contain mixed VAT treatments.

A supplier marked not VAT registered must not be allowed to issue a VAT invoice charging VAT.

Issued invoices snapshot supplier VAT registration status/number and buyer VAT number where present.

## 8. Payment terms

Payment terms are structured, not only free text.

Supported calculation bases:

- `due_on_receipt`
- `from_invoice`
- `end_of_month`
- `custom`

Examples include:

- Pay now / Due on receipt
- 7/14/30/45/60 Days From Invoice
- 14/30/45/60 Days End Of Month
- Custom due date

The PDF must show both Payment Terms and Due Date, including a clear `Please ensure payment is received by ...` statement.

## 9. Supplier/Fleet multi-tenant profile

Each invoicing entity uses the same invoice engine but its own data:

- legal/trading name,
- registered/billing address,
- company registration number where applicable,
- VAT registration status and VAT number,
- billing email/phone/website,
- invoice prefix/numbering sequence,
- default currency,
- default payment terms,
- late-payment policy,
- primary bank details,
- optional invoice-finance/factoring payment details,
- optional issuer logo/branding within XDrive layout rules.

Invoice numbering is scoped per issuer company/entity, not global across the platform.

## 10. Factoring / invoice finance

Invoice finance does not change invoice issuer or debtor.

- Supplier remains the Fleet/Owner Driver.
- Debtor remains Broker/Customer that contracted the supplier.
- Payment destination may be the supplier primary bank or configured invoice-finance account.

The Draft can select `Use invoice finance payment details` when the supplier has configured them.

The chosen payment details are snapshot on issue.

## 11. Job references and operational snapshot

Do not collapse all references into one field.

Invoice V2 distinguishes:

- internal `job_id` UUID,
- canonical XDrive Job Ref,
- Customer/Your Ref,
- Invoice No,
- Invoice Date,
- Due Date.

The invoice operational snapshot must support:

- Date Ordered,
- pickup location/date/time,
- all intermediate stops in sequence,
- final delivery location/date/time,
- actual delivered timestamp,
- vehicle used/type,
- cargo summary,
- recipient/Received By,
- Left At,
- delivery notes,
- POD evidence.

## 12. Visual/PDF contract

Keep the approved XDrive visual direction, not the Courier Exchange visual identity.

Preferred structure:

1. Issuer logo and legal/contact details
2. Invoice metadata card
3. Invoice To / debtor card including buyer VAT
4. PICKUP block
5. DELIVERY / stops block
6. POD evidence strip with real photos/signature
7. Invoice Items table
8. Financial breakdown
9. prominent PAYABLE / Amount Due
10. Public Notes
11. Payment Details / factoring details
12. VAT/company registration/footer and late-payment terms

POD assets are real job evidence only; no stock/fake imagery.

Financial breakdown includes:

- Net/Subtotal
- VAT grouped by treatment/rate where applicable
- Total VAT
- Grand Total / Amount Due

## 13. Draft/Issue/Send workflow

### Draft

Authorised supplier finance users may:

- add/remove extra lines,
- edit quantities and prices for editable lines,
- select valid VAT treatment,
- add public notes,
- add internal notes,
- select payment terms,
- select configured primary/factoring payment account,
- preview PDF,
- save Draft.

Job/POD truth is not edited from invoice editor.

### Create / Issue

`Create` freezes an immutable invoice snapshot and generates/stores the final PDF without sending email.

### Create & Email

Performs Issue, then sends the PDF to the debtor contact and records delivery metadata.

After issue, ordinary editing is prohibited.

If a charge was forgotten after issue, use an appropriate additional invoice/adjustment workflow. If an issued amount must be reduced/refunded, use Credit Note.

## 14. Credit Notes

Credit notes are separate financial documents linked to an issued invoice.

They have their own number, date, reason, line items, VAT reversal and status. Negative invoice totals are not permitted as a substitute for a credit note.

## 15. Access control / confidentiality

Access is based on invoice parties and supplier finance authority, not merely on being a participant in the job.

### Supplier Fleet/Carrier

Only authorised finance-capable supplier members can create/edit/issue/send invoices for their own company.

Recommended finance-capable company membership roles:

- owner,
- admin,
- finance.

### Owner Driver

An Owner Driver/Sole Trader with owner authority for the supplier entity has the same invoice rights as a Fleet owner.

A profile whose app role is `driver` must therefore not be denied if its company membership proves it is the supplier `owner`.

### Assigned/company driver

A normal driver who merely executed the job:

- captures POD,
- cannot create invoice,
- cannot edit amount/VAT,
- cannot issue/send invoice,
- cannot browse Fleet financial invoices.

### Buyer: Broker or Customer

The buyer/debtor may see its issued invoices only.

- Fleet -> Broker invoice: Broker sees it; unrelated/end Customer does not.
- Fleet -> Customer invoice: Customer sees it; unrelated Broker does not.

This protects Broker margin confidentiality.

### Super Admin

Super Admin has global read/audit/support visibility through platform-admin/service-role paths. Ordinary commercial editing is not granted by default. No Super Admin dashboard UI changes are part of this Invoice V2 implementation unless separately approved.

## 16. Audit trail

Capture at minimum:

- draft generated by/system source,
- created_by,
- last_edited_by,
- issued_by / issued_at,
- sent_by / sent_at,
- line-item source/provenance,
- VAT treatment changes,
- payment detail selection,
- credit-note linkage,
- immutable snapshots used to render the issued PDF.

## 17. Non-negotiable invariants

1. A marketplace invoice is always linked to its job and accepted commercial agreement.
2. The supplier is the Fleet/Owner Driver that won/executed the job.
3. The debtor is the Broker/Customer that directly awarded/contracted the job.
4. Normal assigned drivers do not receive Fleet invoice permissions.
5. Owner Drivers do receive supplier-owner invoice permissions for their own entity.
6. Delivered XDrive jobs require valid mobile-driver POD.
7. Final job invoices always carry POD evidence.
8. Accepted transport price is preserved as base invoice-line provenance; extras are separate lines.
9. VAT treatment is per line and distinguishes 0% zero-rated from no-VAT categories.
10. Issued invoices are immutable snapshots.
11. No tenant may read another tenant's invoices unless that tenant is the invoice buyer/debtor.
12. Broker margin must never be exposed to an unrelated/end Customer through Fleet->Broker invoices.
13. Super Admin UI is not modified by this work.
14. No production migration/deploy is performed as part of repository implementation without explicit approval.
