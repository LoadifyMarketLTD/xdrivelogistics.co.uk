import dynamic from 'next/dynamic';
import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';

// Below-the-fold sections: split into separate JS chunks so the browser
// can defer parsing them until after the initial paint is complete.
const KPIStats = dynamic(() => import('./sections/KPIStats').then((m) => ({ default: m.KPIStats })));
const ForDrivers = dynamic(() => import('./sections/ForDrivers').then((m) => ({ default: m.ForDrivers })));
const ForCompanies = dynamic(() => import('./sections/ForCompanies').then((m) => ({ default: m.ForCompanies })));
const HowItWorks = dynamic(() => import('./sections/HowItWorks').then((m) => ({ default: m.HowItWorks })));
const Benefits = dynamic(() => import('./sections/Benefits').then((m) => ({ default: m.Benefits })));
const FAQ = dynamic(() => import('./sections/FAQ').then((m) => ({ default: m.FAQ })));
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
      <KPIStats />
      <div id="for-drivers">
        <ForDrivers />
      </div>
      <div id="for-companies">
        <ForCompanies />
      </div>
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <Benefits />
      <FAQ />
      <div id="contact">
        <Footer />
      </div>
    </div>
  );
}
