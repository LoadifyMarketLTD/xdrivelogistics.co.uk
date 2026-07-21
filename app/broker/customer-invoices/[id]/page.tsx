import InvoiceDetailPage from '../../../components/workspace/InvoiceDetailPage';

type PageProps = { params: Promise<{ id: string }> };

export default async function BrokerCustomerInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <InvoiceDetailPage invoiceId={id} backHref="/broker/customer-invoices" titlePrefix="Customer invoice" />;
}
