import InvoiceDetailPage from '../../../../components/workspace/InvoiceDetailPage';

type PageProps = { params: Promise<{ id: string }> };

export default async function OwnerDriverPayableInvoicePage({ params }: PageProps) {
  const { id } = await params;
  return <InvoiceDetailPage invoiceId={id} backHref="/driver/finance?view=payables" titlePrefix="Supplier invoice" />;
}
