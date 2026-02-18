'use client';

import { Hero } from './sections/Hero';
import { ForDrivers } from './sections/ForDrivers';
import { ForCompanies } from './sections/ForCompanies';
import { HowItWorks } from './sections/HowItWorks';
import { Benefits } from './sections/Benefits';
import { Testimonials } from './sections/Testimonials';
import { Footer } from './sections/Footer';

export function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-primary-navy-dark)',
        overflow: 'hidden',
      }}
    >
      <Hero />
      <ForDrivers />
      <ForCompanies />
      <HowItWorks />
      <Benefits />
      <Testimonials />
      <Footer />
    </div>
  );
}
