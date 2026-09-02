import type { ReactNode } from 'react';

import OnboardingDocumentChecklist from './_components/OnboardingDocumentChecklist';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OnboardingDocumentChecklist />
      {children}
    </>
  );
}
