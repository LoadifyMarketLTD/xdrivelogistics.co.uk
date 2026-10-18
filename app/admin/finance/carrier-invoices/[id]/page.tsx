import InvoiceDetailPage from '../../../../components/workspace/InvoiceDetailPage';

type PageProps = { params: Promise<{ id: string }> };

export default async function CarrierPayableInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <InvoiceDetailPage invoiceId={id} backHref="/admin/finance/carrier-invoices" titlePrefix="Carrier invoice" />;
}
