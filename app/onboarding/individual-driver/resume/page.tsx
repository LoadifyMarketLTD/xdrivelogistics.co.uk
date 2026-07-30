'use client';

import OnboardingTokenPage from '../../[token]/page';

// The route path is retained for backward compatibility. The canonical product
// identity shown to the applicant is Company Driver, and the shared onboarding
// page reads fields and document requirements from the central contract.
export default function CompanyDriverOnboardingResumePage() {
  return <OnboardingTokenPage />;
}
