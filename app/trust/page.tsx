import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/trust',
  title: 'Trust, Verification & Platform Responsibilities',
  description: 'Understand XDrive onboarding standards, member responsibilities, transport payments and the records that support a transparent transport workflow.',
  kicker: 'Trust & Verification',
});

export default function TrustPage() {
  return <MarketingDetailPage
    activeNavHref="/platform"
    kicker="Trust & Verification"
    title="Built on clear standards. Designed for trusted transport."
    intro="XDrive brings customers, brokers, owner drivers and carriers into a more transparent transport network, supported by role-based onboarding, document records and clear operational accountability throughout the job lifecycle."
    sections={[
      { title: 'Member and business evidence', copy: 'Depending on role, onboarding can require identity, company, driver, vehicle or insurance evidence before operational access is enabled.', points: ['Role-specific document requirements', 'Review status recorded', 'Expiry information where applicable'] },
      { title: 'What verification means', copy: 'A reviewed or approved record means XDrive has completed the review represented by that status. It does not turn XDrive into an insurer, regulator or guarantor of another member.', points: ['Review status is evidence-specific', 'No blanket guarantee of a member', 'Members remain responsible for accurate information'] },
      { title: 'Payments and commercial terms', copy: 'The current platform model keeps transport charges and payment terms between the contracting parties. XDrive does not hold client funds as an escrow service.', points: ['No XDrive percentage commission on job value under the launch model', 'No XDrive booking fee under the launch model', 'Invoice and payment records can remain connected to the job'] },
      { title: 'Clear verification boundaries', copy: 'Verification is tied to the specific records and checks completed by XDrive. Additional external verification services are identified only when a confirmed integration is available.', points: ['Evidence-specific review status', 'Clear responsibility for member information', 'External checks identified when available'] },
    ]}
    primaryLabel="Read Help & FAQ"
    primaryHref="/help"
    secondaryLabel="View Product Status"
    secondaryHref="/product-status"
    darkBand={{ title: 'Trust built around clear records and responsibilities.', copy: 'XDrive keeps onboarding evidence, operational records and member responsibilities clear throughout the transport workflow.' }}
  />;
}
