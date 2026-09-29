import ControlledLegalDocumentPage from '../../components/legal/ControlledLegalDocumentPage';

type Props = { searchParams: Promise<{ lang?: string }> };

export default async function Page({ searchParams }: Props) {
  const { lang } = await searchParams;
  return <ControlledLegalDocumentPage code="privacy_policy" lang={lang} />;
}