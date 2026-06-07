import { CurrentPlatformStatusSection } from './sections/CurrentPlatformStatusSection';
import { FaqSection } from './sections/FaqSection';
import { HeroSection } from './sections/HeroSection';
import { InsidePlatformSection } from './sections/InsidePlatformSection';
import { LaunchSection } from './sections/LaunchSection';
import { MarketingFooter } from './sections/MarketingFooter';
import { MarketingHeader } from './sections/MarketingHeader';
import { PlatformModulesSection } from './sections/PlatformModulesSection';
import { PlatformPreviewSection } from './sections/PlatformPreviewSection';
import { RolesSection } from './sections/RolesSection';
import { TrustBarSection } from './sections/TrustBarSection';
import { WhyExistsSection } from './sections/WhyExistsSection';
import { WorkflowSection } from './sections/WorkflowSection';

export function LandingPage() {
  return (
    <div className="bg-white text-[#0f172a]">
      <MarketingHeader />
      <HeroSection />
      <WhyExistsSection />
      <CurrentPlatformStatusSection />
      <TrustBarSection />
      <RolesSection />
      <WorkflowSection />
      <PlatformModulesSection />
      <InsidePlatformSection />
      <PlatformPreviewSection />
      <LaunchSection />
      <FaqSection />
      <MarketingFooter />
    </div>
  );
}
