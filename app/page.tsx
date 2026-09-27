import { MarketingDetailPage } from './(marketing)/_components/MarketingDetailPage';
import { AuthRedirectGuard } from './components/AuthRedirectGuard';
import { buildMarketingMetadata } from '../lib/marketingMetadata';

// Nonce-based CSP requires request-time rendering so Next can attach the
// middleware nonce to its inline bootstrap scripts.
export const dynamic = 'force-dynamic';

export const metadata = buildMarketingMetadata({
  path: '/',
  title: 'XDrive Logistics | Courier & Freight Exchange Platform',
  description: 'Apply to join XDrive and connect courier, carrier, broker and transport-customer operations through one controlled UK courier and freight exchange platform.',
  kicker: 'Controlled Early Access',
});

export default function Home() {
  return (
    <>
      {/* Client-only: silently redirects logged-in users; never blocks rendering */}
      <AuthRedirectGuard />
      <MarketingDetailPage
        kicker="Controlled Early Access"
        title="Apply to join XDrive before paid membership begins."
        intro="XDrive is rolling out in a controlled way. Customers complete account onboarding before entering their workspace, while brokers, carriers and owner drivers complete the applicable company, identity and compliance checks before restricted access is lifted."
        primaryLabel="Request Early Access"
        primaryHref="/register"
        sections={[
          { title: 'Who can apply', copy: 'The current rollout is aimed at owner drivers, courier companies, carriers, brokers and transport customers that fit the UK operating model.', points: ['Owner drivers', 'Courier and carrier companies', 'Brokers and transport customers'] },
          { title: 'What happens after you apply', copy: 'Access follows the role you register for. Customers complete account onboarding directly; brokers, carriers and owner drivers complete the relevant company, identity and compliance review before full operating access is enabled.', points: ['Role-specific onboarding', 'Company or identity checks where required', 'Correct workspace access'] },
          { title: 'Your free period', copy: 'Approved members receive the launch access period before paid membership begins.', points: ['3 months free', 'Selected plan visible', 'Paid membership only after the free period'] },
          { title: 'Commercial clarity', copy: 'XDrive is designed around a predictable membership model rather than taking a percentage of every transport job.', points: ['No XDrive commission on job value', 'No XDrive booking fee', 'Monthly rolling membership afterwards'] },
        ]}
        darkBand={{ title: 'Reviewed access. Clear pricing. A network built deliberately.', copy: 'The aim is to grow XDrive with real operators and real transport activity while keeping the onboarding and commercial model transparent.' }}
      />
    </>
  );
}
