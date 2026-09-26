import type { Metadata } from 'next';
import RoleTradingTermsDocumentPage from '../../components/legal/RoleTradingTermsDocumentPage';
import { getRoleTradingTerms } from '../../../lib/legal/roleTradingTerms';

const document = getRoleTradingTerms('carrier_fleet_terms');

export const metadata: Metadata = {
  title: 'Carrier / Fleet Trading Terms | XDrive Logistics',
  description: 'Role-specific trading terms for carrier and fleet businesses using XDrive.',
  alternates: { canonical: document.href },
};

export default function Page() {
  return <RoleTradingTermsDocumentPage document={document} />;
}