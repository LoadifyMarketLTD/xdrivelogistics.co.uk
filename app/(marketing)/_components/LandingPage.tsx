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
    <div className="bg-white text-[#0f172a]">
      <MarketingHeader />
      <HeroSection />
      <TrustBarSection />
      <WhyExistsSection />
      <RolesSection />
      <WorkflowSection />
      <PlatformModulesSection />
      <LaunchSection />
      <FAQ />
      <MarketingFooter />
    </div>
  );
}
