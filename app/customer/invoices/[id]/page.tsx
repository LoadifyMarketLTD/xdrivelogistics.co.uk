import InvoiceDetailPage from '../../../components/workspace/InvoiceDetailPage';

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <InvoiceDetailPage invoiceId={id} backHref="/customer/invoices" titlePrefix="Customer invoice" />;
}
