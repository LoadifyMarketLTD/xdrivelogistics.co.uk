import type { Metadata } from 'next';
import RoleTradingTermsDocumentPage from '../../components/legal/RoleTradingTermsDocumentPage';
import { getRoleTradingTerms } from '../../../lib/legal/roleTradingTerms';

const document = getRoleTradingTerms('broker_terms');

export const metadata: Metadata = {
  title: 'Transport Broker Trading Terms | XDrive Logistics',
  description: 'Role-specific trading terms for transport brokers using XDrive.',
  alternates: { canonical: document.href },
};

export default function Page() {
  return <RoleTradingTermsDocumentPage document={document} />;
}