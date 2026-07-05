import { CurrentPlatformStatusSection } from './sections/CurrentPlatformStatusSection';
import { FAQ } from './sections/FAQ';
import { HeroSection } from './sections/HeroSection';
import { LaunchSection } from './sections/LaunchSection';
import { MarketingFooter } from './sections/MarketingFooter';
import { MarketingHeader } from './sections/MarketingHeader';
import { PlatformModulesSection } from './sections/PlatformModulesSection';
import { RolesSection } from './sections/RolesSection';
import { TrustBarSection } from './sections/TrustBarSection';
import { WhyExistsSection } from './sections/WhyExistsSection';
import { WorkflowSection } from './sections/WorkflowSection';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <MarketingHeader />
      <main>
        <HeroSection />
        <TrustBarSection />
        <WhyExistsSection />
        <RolesSection />
        <PlatformModulesSection />
        <WorkflowSection />
        <CurrentPlatformStatusSection />
        <FAQ />
        <LaunchSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
