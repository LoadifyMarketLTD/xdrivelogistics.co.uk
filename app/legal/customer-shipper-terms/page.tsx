import type { Metadata } from 'next';
import RoleTradingTermsDocumentPage from '../../components/legal/RoleTradingTermsDocumentPage';
import { getRoleTradingTerms } from '../../../lib/legal/roleTradingTerms';

const document = getRoleTradingTerms('customer_shipper_terms');

export const metadata: Metadata = {
  title: 'Customer / Shipper Trading Terms | XDrive Logistics',
  description: 'Role-specific trading terms for customers and shippers using XDrive.',
  alternates: { canonical: document.href },
};

export default function Page() {
  return <RoleTradingTermsDocumentPage document={document} />;
}