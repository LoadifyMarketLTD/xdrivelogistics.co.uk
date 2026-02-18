import { useState } from 'react';
import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';
import { Stats } from './sections/Stats';
import { Services } from './sections/Services';
import { HowItWorks } from './sections/HowItWorks';
import { Benefits } from './sections/Benefits';
import { Testimonials } from './sections/Testimonials';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';
import { LoginModal } from './components/LoginModal';

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onLoginClick={() => setIsLoginOpen(true)} />
      <main>
        <Hero onLoginClick={() => setIsLoginOpen(true)} />
        <Stats />
        <Services />
        <HowItWorks />
        <Benefits />
        <Testimonials />
        <CTA onLoginClick={() => setIsLoginOpen(true)} />
      </main>
      <Footer />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}

export default App;
