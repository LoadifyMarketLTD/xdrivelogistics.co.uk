import { MarketingDetailPage } from './(marketing)/_components/MarketingDetailPage';
import { AuthRedirectGuard } from './components/AuthRedirectGuard';

export default function Home() {
  return (
    <>
      {/* Client-only: silently redirects logged-in users; never blocks rendering */}
      <AuthRedirectGuard />
      <MarketingDetailPage
        kicker="Controlled Early Access"
        title="Apply to join XDrive before paid membership begins."
        intro="XDrive is rolling out in a controlled way. Applications are reviewed so the network can grow around real courier, carrier, broker and transport-customer operations rather than anonymous sign-ups."
        primaryLabel="Request Early Access"
        primaryHref="/register"
        sections={[
          { title: 'Who can apply', copy: 'The current rollout is aimed at owner drivers, courier companies, carriers, brokers and transport customers that fit the UK operating model.', points: ['Owner drivers', 'Courier and carrier companies', 'Brokers and transport customers'] },
          { title: 'What happens after you apply', copy: 'Your application is reviewed before access is granted. This keeps onboarding intentional and helps protect the quality of the network.', points: ['Application review', 'Role and company context', 'Access confirmation'] },
          { title: 'Your free period', copy: 'Approved members receive the launch access period before paid membership begins.', points: ['3 months free', 'Selected plan visible', 'Paid membership only after the free period'] },
          { title: 'Commercial clarity', copy: 'XDrive is designed around a predictable membership model rather than taking a percentage of every transport job.', points: ['No XDrive commission on job value', 'No XDrive booking fee', 'Monthly rolling membership afterwards'] },
        ]}
        darkBand={{ title: 'Reviewed access. Clear pricing. A network built deliberately.', copy: 'The aim is to grow XDrive with real operators and real transport activity while keeping the onboarding and commercial model transparent.' }}
      />
    </>
  );
}
