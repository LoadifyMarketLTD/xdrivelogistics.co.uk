import { redirect } from 'next/navigation';

type OnboardingPageProps = {
  params: Promise<{ token: string }>;
};

export default async function OwnerDriverOnboardingPage({ params }: OnboardingPageProps) {
  const { token } = await params;
  redirect(`/onboarding/${encodeURIComponent(token)}`);
}