'use client';

import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';
import { ForDrivers } from './sections/ForDrivers';
import { ForCompanies } from './sections/ForCompanies';
import { HowItWorks } from './sections/HowItWorks';
import { Benefits } from './sections/Benefits';
import { Testimonials } from './sections/Testimonials';
import { FAQ } from './sections/FAQ';
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
      <Navbar />
      <div id="home">
        <Hero />
      </div>
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
      <Testimonials />
      <FAQ />
      <div id="contact">
        <Footer />
      </div>
    </div>
  );
}
