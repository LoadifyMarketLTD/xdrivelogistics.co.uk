import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/trust',
  title: 'Trust, Verification & Platform Responsibilities',
  description: 'Understand what XDrive reviews, what members remain responsible for, how transport payments work and what XDrive does not claim to provide.',
  kicker: 'Trust & Verification',
});

export default function TrustPage() {
  return <MarketingDetailPage
    activeNavHref="/platform"
    kicker="Trust & Verification"
    title="Clear responsibilities. No invented assurances."
    intro="XDrive uses role-based onboarding and operational records to support a safer transport workflow. We distinguish between information supplied by members, records reviewed by XDrive and external checks that are only described when a real integration exists."
    sections={[
      { title: 'Member and business evidence', copy: 'Depending on role, onboarding can require identity, company, driver, vehicle or insurance evidence before operational access is enabled.', points: ['Role-specific document requirements', 'Review status recorded', 'Expiry information where applicable'] },
      { title: 'What verification means', copy: 'A reviewed or approved record means XDrive has completed the review represented by that status. It does not turn XDrive into an insurer, regulator or guarantor of another member.', points: ['Review status is evidence-specific', 'No blanket guarantee of a member', 'Members remain responsible for accurate information'] },
      { title: 'Payments and commercial terms', copy: 'The current platform model keeps transport charges and payment terms between the contracting parties. XDrive does not hold client funds as an escrow service.', points: ['No XDrive percentage commission on job value under the launch model', 'No XDrive booking fee under the launch model', 'Invoice and payment records can remain connected to the job'] },
      { title: 'Claims we do not make', copy: 'XDrive does not publicly claim biometric facial verification, automatic insurer-database validation or guaranteed payment unless a specific verified capability is expressly identified as available.', points: ['No invented biometric capability', 'No implied insurer API', 'No unsupported payment guarantee'] },
    ]}
    primaryLabel="Read Help & FAQ"
    primaryHref="/help"
    secondaryLabel="View Product Status"
    secondaryHref="/product-status"
    darkBand={{ title: 'Trust comes from precise evidence.', copy: 'XDrive describes the capability that actually exists, the party responsible for each transport obligation and the status of the underlying record.' }}
  />;
}
