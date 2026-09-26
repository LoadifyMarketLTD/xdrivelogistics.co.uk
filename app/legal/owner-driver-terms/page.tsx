import type { Metadata } from 'next';
import RoleTradingTermsDocumentPage from '../../components/legal/RoleTradingTermsDocumentPage';
import { getRoleTradingTerms } from '../../../lib/legal/roleTradingTerms';

const document = getRoleTradingTerms('owner_driver_terms');

export const metadata: Metadata = {
  title: 'Owner Driver / Carrier Terms | XDrive Logistics',
  description: 'Role-specific trading terms for owner drivers and self-employed carriers using XDrive.',
  alternates: { canonical: document.href },
};

export default function Page() {
  return <RoleTradingTermsDocumentPage document={document} />;
}