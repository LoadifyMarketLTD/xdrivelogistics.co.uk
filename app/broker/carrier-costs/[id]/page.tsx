import InvoiceDetailPage from '../../../components/workspace/InvoiceDetailPage';

type PageProps = { params: Promise<{ id: string }> };

export default async function BrokerCarrierInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <InvoiceDetailPage invoiceId={id} backHref="/broker/carrier-costs" titlePrefix="Carrier invoice" />;
}
