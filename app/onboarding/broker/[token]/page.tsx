import { BrokerOnboarding } from '../../_components/BrokerOnboarding';

type OnboardingPageProps = {
  params: Promise<{ token: string }>;
};

export default async function BrokerOnboardingPage({ params }: OnboardingPageProps) {
  const { token } = await params;
  return <BrokerOnboarding token={decodeURIComponent(token)} />;
}