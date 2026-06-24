import { FAQ } from './sections/FAQ';
import { HeroSection } from './sections/HeroSection';
import { LaunchSection } from './sections/LaunchSection';
import { MarketingFooter } from './sections/MarketingFooter';
import { MarketingHeader } from './sections/MarketingHeader';
import { MobileDriverLanding } from './sections/MobileDriverLanding';
import { PlatformModulesSection } from './sections/PlatformModulesSection';
import { PlatformPreviewSection } from './sections/PlatformPreviewSection';
import { ProblemsSection } from './sections/ProblemsSection';
import { RolesSection } from './sections/RolesSection';
import { TrustBarSection } from './sections/TrustBarSection';
import { WhyExistsSection } from './sections/WhyExistsSection';
import { WorkflowSection } from './sections/WorkflowSection';

export function LandingPage() {
  return (
    <div className="bg-white text-[#0f172a]">
      <MobileDriverLanding />
      <div className="hidden md:block">
        <MarketingHeader />
        <HeroSection />
        <TrustBarSection />
        <WhyExistsSection />
        <ProblemsSection />
        <RolesSection />
        <WorkflowSection />
        <PlatformModulesSection />
        <PlatformPreviewSection />
        <LaunchSection />
        <FAQ />
        <MarketingFooter />
      </div>
    </div>
  );
}
