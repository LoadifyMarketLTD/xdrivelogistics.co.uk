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
4. Invoice is automatically saved to your browser

### Managing Invoices
- **Search**: Type in the search box to find invoices by number, job ref, or client name
- **Filter**: Use the status dropdown to show only Paid, Pending, or Overdue invoices
- **View**: Click on any invoice row to open the details
- **Edit**: Make changes in the detail view and click "Save Invoice"

### Sharing Invoices
- **Preview**: Toggle the preview to see how the invoice will look
- **Print**: Click the print button to generate a physical copy
- **WhatsApp**: Click WhatsApp button to share invoice details via WhatsApp

### Invoice Status
- **Pending** (Yellow): Invoice not yet paid and not overdue
- **Overdue** (Red): Invoice past due date and not paid
- **Paid** (Green): Invoice has been paid

Status is automatically calculated based on the due date.

## Technical Details

### Storage
Currently uses browser localStorage with key `dannycourier_invoices`. Data persists across browser sessions but is cleared if browser cache is cleared.

### Auto-Generated IDs
- **Job Ref Format**: `DC-YYMMDD-XXXX` (e.g., DC-250213-1234)
- **Invoice Number Format**: `INV-YYYYMM-XXX` (e.g., INV-202502-123)

Both use timestamp-based generation to prevent collisions.

### Payment Details
Bank Transfer:
- Sort Code: 04-00-04 (PLACEHOLDER)
- Account: 12345678 (PLACEHOLDER)

PayPal: dannycourierltd@gmail.com

**Note**: Bank details are placeholders for development. Update in `app/config/company.ts` for production.

### Files
- `page.tsx` - Invoice list page
- `[id]/page.tsx` - Invoice detail/edit page
- `../../components/InvoiceTemplate.tsx` - Invoice display component
- `../../config/company.ts` - Company configuration

## Future Enhancements
- Database backend integration
- PDF export functionality
- Email sending
- Payment tracking
- Recurring invoices
- Client portal

## Support
For issues or feature requests, contact the development team.
