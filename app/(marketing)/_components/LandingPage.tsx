import dynamic from 'next/dynamic';
import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';

const RoleCards = dynamic(() => import('./sections/KPIStats').then((m) => ({ default: m.KPIStats })));
const MarketplaceExchange = dynamic(() => import('./sections/ForDrivers').then((m) => ({ default: m.ForDrivers })));
const HowItWorks = dynamic(() => import('./sections/HowItWorks').then((m) => ({ default: m.HowItWorks })));
const OperationsSection = dynamic(() => import('./sections/ForCompanies').then((m) => ({ default: m.ForCompanies })));
const OwnerOperatorSection = dynamic(() => import('./sections/Benefits').then((m) => ({ default: m.Benefits })));
const TrustCompliance = dynamic(() => import('./sections/TrustCompliance').then((m) => ({ default: m.TrustCompliance })));
const FAQ = dynamic(() => import('./sections/FAQ').then((m) => ({ default: m.FAQ })));
const FinalCTA = dynamic(() => import('./sections/FinalCTA').then((m) => ({ default: m.FinalCTA })));
const Footer = dynamic(() => import('./sections/Footer').then((m) => ({ default: m.Footer })));

export function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-primary-navy-dark)',
        overflow: 'hidden',
      }}
    >
      <Navbar />
      <div id="home">
        <Hero />
      </div>
      <div id="roles">
        <RoleCards />
      </div>
      <div id="exchange">
        <MarketplaceExchange />
      </div>
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <div id="operations">
        <OperationsSection />
      </div>
      <div id="owner-operator">
        <OwnerOperatorSection />
      </div>
      <div id="trust">
        <TrustCompliance />
      </div>
      <FAQ />
      <div id="final-cta">
        <FinalCTA />
      </div>
      <div id="contact">
        <Footer />
      </div>
    </div>
  );
}
