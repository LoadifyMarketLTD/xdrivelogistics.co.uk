import { CustomerOnboarding } from '../../_components/CustomerOnboarding';

type OnboardingPageProps = {
  params: Promise<{ token: string }>;
};

export default async function CustomerOnboardingPage({ params }: OnboardingPageProps) {
  const { token } = await params;
  return <CustomerOnboarding token={decodeURIComponent(token)} />;
}