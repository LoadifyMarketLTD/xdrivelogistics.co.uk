import ControlledLegalDocumentPage from '../../components/legal/ControlledLegalDocumentPage';

type Props = { searchParams: Promise<{ lang?: string }> };

export default async function Page({ searchParams }: Props) {
  const { lang } = await searchParams;
  return <ControlledLegalDocumentPage code="customer_shipper_terms" lang={lang} />;
}