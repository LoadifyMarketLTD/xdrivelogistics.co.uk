import { LandingPage } from './(marketing)/_components/LandingPage';
import { LegalDisclosureBar } from './(marketing)/_components/LegalDisclosureBar';
import { AuthRedirectGuard } from './components/AuthRedirectGuard';

export default function Home() {
  return (
    <>
      {/* Client-only: silently redirects logged-in users; never blocks rendering */}
      <AuthRedirectGuard />
      <LandingPage />
      <LegalDisclosureBar />
    </>
  );
}
