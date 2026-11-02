# Invoice Management System

## Quick Start

### Accessing the System
1. Login to admin portal at `/login`
2. Navigate to "Invoices" from the sidebar menu
3. Or click "View Invoices" from the dashboard

### Creating an Invoice
1. Click **"+ Create New Invoice"** button
2. Fill in the form:
   - Job Ref and Invoice Number are auto-generated
   - Select invoice date
   - Choose payment terms (14 or 30 days)
   - Enter client details
   - Add pickup location and date/time
   - Add delivery location, date/time, and recipient
   - Describe the service
   - Enter the amount
3. Click **"Save Invoice"**
4. Invoice is saved to Supabase and shared across authenticated sessions in the same tenant

### Managing Invoices
- **Search**: Type in the search box to find invoices by number, job ref, or client name
- **Filter**: Use the status tabs to show Draft, Sent, Overdue, Paid, Disputed, or Cancelled invoices
- **View**: Click on any invoice row to open the details
- **Edit**: Make changes in the detail view and click "Save Invoice"

### Sharing Invoices
- **Preview**: Toggle the preview to see how the invoice will look
- **Print**: Click the print button to generate a physical copy
- **WhatsApp**: Click WhatsApp button to share invoice details via WhatsApp

### Invoice Status
- **Draft** (Yellow): Invoice created but not yet sent
- **Sent** (Indigo): Invoice sent to the client and awaiting settlement
- **Overdue** (Red): Invoice past due date and not paid
- **Paid** (Green): Invoice has been paid
- **Disputed** (Pink): Invoice currently under dispute
- **Cancelled** (Slate): Invoice cancelled and no longer collectible

Status is automatically calculated from lifecycle state and due date where applicable.

### Legacy Database Mapping (Backwards Compatibility)

Current production schemas may still persist legacy enum values. The active UI/API layer maps them to canonical statuses:

| Legacy DB value | Canonical UI/API status |
| --- | --- |
| `Pending` | `Draft` |
| `Submitted` | `Sent` |
| `Approved` | `Sent` |

Write compatibility rules:
- `Draft` writes map to `Pending` where legacy enum schemas still apply.
- `Sent` writes map to `Submitted` where legacy enum schemas still apply.
- Canonical values (`Overdue`, `Paid`, `Disputed`, `Cancelled`) pass through directly when supported.

## Technical Details

### Storage
Invoices are stored in Supabase (`invoices` table) and tenant-scoped by `company_id`.

Job → invoice prefill is passed through URL search params from `/admin/jobs/[id]` to `/admin/invoices/new`.

### Auto-Generated IDs
- **Job Ref Format**: `DC-YYMMDD-XXXX` (e.g., DC-250213-1234)
- **Invoice Number Format**: `INV-YYYYMM-XXX` (e.g., INV-202502-123)

Both use timestamp-based generation to prevent collisions.

### Payment Details
Bank Transfer:
- Sort Code: 04-00-04 (PLACEHOLDER)
- Account: 12345678 (PLACEHOLDER)

PayPal: contact@xdrivelogistics.co.uk

**Note**: Bank details are placeholders for development. Update in `app/config/company.ts` for production.

### Files
- `page.tsx` - Invoice list page
- `[id]/page.tsx` - Invoice detail/edit page
- `../../components/InvoiceTemplate.tsx` - Invoice display component
- `../../config/company.ts` - Company configuration

## Future Enhancements
- PDF export functionality
- Email sending
- Payment tracking
- Recurring invoices
- Client portal

## Support
For issues or feature requests, contact the development team.
