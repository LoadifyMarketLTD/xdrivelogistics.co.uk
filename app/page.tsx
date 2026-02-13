'use client';

import { useState } from 'react';

const WHATSAPP_URL = "https://wa.me/447423272138?text=Hello%2C%20I%27d%20like%20to%20inquire%20about%20your%20courier%20services";

const SOCIAL_MEDIA_LINKS = [
  { name: 'Facebook', icon: '📘', url: '#' },
  { name: 'Instagram', icon: '📷', url: '#' },
  { name: 'TikTok', icon: '🎵', url: '#' },
  { name: 'LinkedIn', icon: '💼', url: '#' }
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState('EN');
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  const handleQuoteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    console.log('Quote Form Submitted:', Object.fromEntries(formData));
    setQuoteSuccess(true);
    e.currentTarget.reset();
    setTimeout(() => setQuoteSuccess(false), 5000);
  };

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    console.log('Contact Form Submitted:', Object.fromEntries(formData));
    setContactSuccess(true);
    e.currentTarget.reset();
    setTimeout(() => setContactSuccess(false), 5000);
  };

  return (
    <main style={{ backgroundColor: '#0a1628', minHeight: '100vh' }}>
      {/* 1. NAVIGATION (STICKY) - DARK GLASS */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(10, 22, 40, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        height: '56px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%'
        }}>
          {/* Logo */}
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Danny Courier Ltd
          </div>

          {/* Desktop Navigation */}
          <div style={{ 
            display: 'none',
            gap: '32px',
            alignItems: 'center'
          }} className="desktop-nav">
            <a href="#home" style={{ fontWeight: '500', color: '#ffffff', transition: 'color 0.2s' }} className="nav-link">Home</a>
            <a href="#services" style={{ fontWeight: '500', color: '#ffffff', transition: 'color 0.2s' }} className="nav-link">Services</a>
            <a href="#about" style={{ fontWeight: '500', color: '#ffffff', transition: 'color 0.2s' }} className="nav-link">About Us</a>
            <a href="#contact" style={{ fontWeight: '500', color: '#ffffff', transition: 'color 0.2s' }} className="nav-link">Contact</a>
          </div>

          {/* Right Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Language Switcher */}
            <div style={{ display: 'flex', gap: '8px', fontSize: '14px' }}>
              {['EN', 'DE', 'FR', 'ES'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    background: language === lang ? '#d4af37' : 'transparent',
                    color: language === lang ? '#0a1628' : 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* CTA Button - Desktop Only */}
            <a href="#quote" style={{ 
              display: 'none',
              height: '40px',
              padding: '0 20px',
              fontSize: '14px',
              background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
              color: '#0a1628',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.4)'
            }} id="nav-cta">
              Get a Quote
            </a>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px'
              }}
              className="mobile-menu-btn"
              aria-label="Toggle menu"
            >
              <span style={{ width: '24px', height: '2px', backgroundColor: '#d4af37' }}></span>
              <span style={{ width: '24px', height: '2px', backgroundColor: '#d4af37' }}></span>
              <span style={{ width: '24px', height: '2px', backgroundColor: '#d4af37' }}></span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '56px',
            left: 0,
            right: 0,
            backgroundColor: 'rgba(10, 22, 40, 0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
            padding: '16px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="#home" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#ffffff' }}>Home</a>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#ffffff' }}>Services</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#ffffff' }}>About Us</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#ffffff' }}>Contact</a>
              <a href="#quote" style={{ 
                marginTop: '8px',
                padding: '12px',
                background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                color: '#0a1628',
                fontWeight: '700',
                borderRadius: '8px',
                textAlign: 'center',
                textDecoration: 'none'
              }}>Get a Quote</a>
            </div>
          </div>
        )}
      </nav>

      <style jsx>{`
        @media (min-width: 1024px) {
          nav {
            height: 64px !important;
          }
          .desktop-nav {
            display: flex !important;
          }
          #nav-cta {
            display: inline-flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }
        .nav-link:hover {
          color: #d4af37 !important;
        }
        #nav-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.6) !important;
        }
      `}</style>

      {/* 2. HERO SECTION - CINEMATIC DARK */}
      <section id="home" style={{
        minHeight: '500px',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(180deg, #0a1628 0%, #050c16 50%, #000000 100%)',
        color: 'white',
        position: 'relative',
        padding: '60px 0 80px'
      }}>
        {/* Animated gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 40%, rgba(212, 175, 55, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(0, 212, 255, 0.06) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>
        
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '50px',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '24px',
              color: '#00d4ff'
            }}>
              🚚 Available 24/7 Across UK & Europe
            </div>
            
            <h1 style={{ 
              color: '#ffffff', 
              marginBottom: '20px', 
              lineHeight: '1.1',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: '800',
              textShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
            }}>
              Reliable Same Day & Express Transport
            </h1>
            
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 3vw, 2rem)', 
              fontWeight: '600',
              background: 'linear-gradient(135deg, #d4af37 0%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '24px'
            }}>
              Across the UK & Europe
            </h2>
            
            <p style={{ 
              fontSize: 'clamp(16px, 2vw, 18px)', 
              marginBottom: '40px',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: '1.7',
              maxWidth: '700px',
              margin: '0 auto 40px'
            }}>
              Fast, Secure & On-Time Deliveries 24/7. Professional courier and logistics services you can trust.
            </p>
            
            {/* CTAs */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '16px', 
              marginBottom: '32px',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ 
                height: '56px', 
                fontSize: '17px',
                padding: '0 32px',
                background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                color: '#0a1628',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(212, 175, 55, 0.5)',
                transition: 'all 0.3s'
              }} className="gold-btn">
                📦 Get a Free Quote
              </a>
              <a href="tel:07423272138" style={{ 
                height: '56px',
                fontSize: '17px',
                padding: '0 32px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(0, 212, 255, 0.4)',
                color: '#00d4ff',
                borderRadius: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                transition: 'all 0.3s'
              }} className="electric-btn">
                📞 Call: 07423 272 138
              </a>
            </div>

            {/* Contact Info */}
            <div style={{ 
              display: 'flex', 
              gap: '24px', 
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '14px', 
              color: 'rgba(255, 255, 255, 0.7)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📧</span>
                <a href="mailto:xdrivelogisticsltd@gmail.com" style={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(212, 175, 55, 0.4)'
                }}>
                  xdrivelogisticsltd@gmail.com
                </a>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '6px 14px',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '8px',
                color: '#d4af37'
              }}>
                <span>✓</span>
                <span>Fully Insured & Licensed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (min-width: 768px) {
          #home {
            min-height: 520px !important;
          }
        }
        @media (min-width: 1024px) {
          #home {
            min-height: 560px !important;
          }
        }
        .gold-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(212, 175, 55, 0.7) !important;
        }
        .electric-btn:hover {
          background-color: rgba(0, 212, 255, 0.1) !important;
          border-color: rgba(0, 212, 255, 0.6) !important;
          transform: translateY(-2px);
        }
      `}</style>

      {/* 3. SOCIAL MEDIA ICONS SECTION */}
      <section style={{ 
        backgroundColor: '#050c16',
        padding: '40px 0',
        borderTop: '1px solid rgba(212, 175, 55, 0.1)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.1)'
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h3 style={{ 
              color: '#d4af37', 
              fontSize: '18px', 
              fontWeight: '600',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>Connect With Us</h3>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            {SOCIAL_MEDIA_LINKS.map((social, idx) => (
              <a 
                key={idx}
                href={social.url}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  border: '2px solid #d4af37',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  transition: 'all 0.3s',
                  backgroundColor: 'rgba(10, 22, 40, 0.5)',
                  boxShadow: '0 0 0 rgba(212, 175, 55, 0.5)',
                  textDecoration: 'none'
                }}
                className="social-icon"
                aria-label={social.name}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        .social-icon:hover {
          transform: scale(1.1);
          box-shadow: 0 0 24px rgba(212, 175, 55, 0.6) !important;
          border-color: #f4d03f !important;
        }
      `}</style>

      {/* 4. BENEFITS / SERVICES PREVIEW */}
      <section style={{ 
        backgroundColor: '#0a1628',
        padding: '60px 0',
        position: 'relative'
      }}>
        <div className="container">
          <div className="grid grid-3" style={{ textAlign: 'center', gap: '24px' }}>
            <div style={{ 
              padding: '32px 24px',
              backgroundColor: 'rgba(10, 22, 40, 0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s'
            }} className="benefit-card-dark">
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px'
              }}>🕐</div>
              <h3 style={{ 
                fontSize: '20px', 
                marginBottom: '12px',
                fontWeight: '700',
                color: '#d4af37'
              }}>24/7 Service</h3>
              <p style={{ fontSize: '15px', marginBottom: 0, lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
                Round-the-clock availability for all your urgent transport needs
              </p>
            </div>
            <div style={{ 
              padding: '32px 24px',
              backgroundColor: 'rgba(10, 22, 40, 0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s'
            }} className="benefit-card-dark">
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px'
              }}>🌍</div>
              <h3 style={{ 
                fontSize: '20px', 
                marginBottom: '12px',
                fontWeight: '700',
                color: '#d4af37'
              }}>Nationwide & Europe</h3>
              <p style={{ fontSize: '15px', marginBottom: 0, lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
                Comprehensive UK and EU coverage with reliable delivery
              </p>
            </div>
            <div style={{ 
              padding: '32px 24px',
              backgroundColor: 'rgba(10, 22, 40, 0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s'
            }} className="benefit-card-dark">
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px'
              }}>🛡️</div>
              <h3 style={{ 
                fontSize: '20px', 
                marginBottom: '12px',
                fontWeight: '700',
                color: '#d4af37'
              }}>Fully Insured</h3>
              <p style={{ fontSize: '15px', marginBottom: 0, lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
                Your cargo is fully protected with comprehensive insurance
              </p>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .benefit-card-dark:hover {
          transform: translateY(-4px);
          border-color: rgba(212, 175, 55, 0.5) !important;
          box-shadow: 0 12px 32px rgba(212, 175, 55, 0.2) !important;
        }
      `}</style>

      {/* 5. QUOTE FORM SECTION - GLASS DARK */}
      <section id="quote" style={{ 
        backgroundColor: '#050c16',
        padding: '60px 0',
        borderTop: '1px solid rgba(212, 175, 55, 0.1)'
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ 
              marginBottom: '16px',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              color: '#ffffff',
              fontWeight: '800'
            }}>Ready to Move Your Freight?</h2>
            <p style={{ 
              fontSize: '18px', 
              color: 'rgba(255, 255, 255, 0.7)',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Fast, competitive pricing for all your transport needs
            </p>
          </div>
          
          <div style={{ maxWidth: '740px', margin: '0 auto', width: '100%' }}>
            {/* Quote Form - Dark Glass */}
            <div style={{
              padding: '32px',
              backgroundColor: 'rgba(10, 22, 40, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '20px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <h3 style={{ marginBottom: '24px', color: '#d4af37', fontSize: '22px', fontWeight: '700' }}>Get a Quick Quote</h3>
              
              {quoteSuccess && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(212, 175, 55, 0.2)',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>✓</span>
                  <span>Quote request received! We will contact you shortly.</span>
                </div>
              )}

              <form onSubmit={handleQuoteSubmit}>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="form-row">
                    <div>
                      <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                        Name *
                      </label>
                      <input type="text" id="name" name="name" required placeholder="Your full name" style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px'
                      }} />
                    </div>
                    <div>
                      <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                        Email *
                      </label>
                      <input type="email" id="email" name="email" required placeholder="your.email@example.com" style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="form-row">
                    <div>
                      <label htmlFor="pickup" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                        Pickup Location *
                      </label>
                      <input type="text" id="pickup" name="pickup" required placeholder="City, Postcode, or Address" style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px'
                      }} />
                    </div>
                    <div>
                      <label htmlFor="delivery" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                        Delivery Location *
                      </label>
                      <input type="text" id="delivery" name="delivery" required placeholder="City, Postcode, or Address" style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="form-row">
                    <div>
                      <label htmlFor="cargo" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                        Cargo Details *
                      </label>
                      <select id="cargo" name="cargo" required style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px'
                      }}>
                        <option value="">Select cargo type</option>
                        <option value="documents">Documents / Small Parcel</option>
                        <option value="packages">Packages (up to 30kg)</option>
                        <option value="pallets">Pallets</option>
                        <option value="large">Large Items / Furniture</option>
                        <option value="other">Other (specify in message)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="quantity" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                        Quantity
                      </label>
                      <input type="number" id="quantity" name="quantity" min="1" defaultValue="1" placeholder="Number of items" style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px'
                      }} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#ffffff' }}>
                      Additional Details
                    </label>
                    <textarea 
                      id="message" 
                      name="message" 
                      placeholder="Any special requirements or additional information..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px',
                        fontFamily: 'inherit'
                      }}
                    ></textarea>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="submit" style={{ 
                      minWidth: '200px',
                      padding: '14px 32px',
                      background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                      color: '#0a1628',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '16px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
                      transition: 'all 0.3s'
                    }} className="submit-gold-btn">
                      Request a Quote
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Contact Buttons */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '16px', 
            justifyContent: 'center',
            marginTop: '40px'
          }}>
            <a 
              href={WHATSAPP_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                color: '#0a1628',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(212, 175, 55, 0.4)',
                transition: 'all 0.3s'
              }}
              className="gold-cta-btn"
            >
              <span style={{ fontSize: '20px' }}>💬</span> WhatsApp
            </a>
            <a 
              href="mailto:xdrivelogisticsltd@gmail.com"
              style={{ 
                padding: '14px 28px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(0, 212, 255, 0.4)',
                color: '#00d4ff',
                borderRadius: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                transition: 'all 0.3s'
              }}
              className="electric-cta-btn"
            >
              <span style={{ fontSize: '20px' }}>📧</span> Email Us
            </a>
            <a 
              href="tel:07423272138"
              style={{ 
                padding: '14px 28px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(212, 175, 55, 0.4)',
                color: '#d4af37',
                borderRadius: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                transition: 'all 0.3s'
              }}
              className="gold-outline-btn"
            >
              <span style={{ fontSize: '20px' }}>📞</span> Call Now
            </a>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (min-width: 768px) {
          .form-row {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        input::placeholder, textarea::placeholder, select {
          color: rgba(255, 255, 255, 0.4);
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: rgba(0, 212, 255, 0.6) !important;
        }
        .submit-gold-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(212, 175, 55, 0.6) !important;
        }
        .gold-cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(212, 175, 55, 0.6) !important;
        }
        .electric-cta-btn:hover {
          background-color: rgba(0, 212, 255, 0.1) !important;
          border-color: rgba(0, 212, 255, 0.6) !important;
          transform: translateY(-2px);
        }
        .gold-outline-btn:hover {
          background-color: rgba(212, 175, 55, 0.1) !important;
          border-color: rgba(212, 175, 55, 0.6) !important;
          transform: translateY(-2px);
        }
      `}</style>

      {/* 6. SERVICES SECTION - COMPACT */}
      <section id="services" style={{ 
        backgroundColor: '#0a1628',
        padding: '60px 0'
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ 
              marginBottom: '16px',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              color: '#ffffff',
              fontWeight: '800'
            }}>Our Services</h2>
            <p style={{ 
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Comprehensive transport solutions tailored to your needs
            </p>
          </div>

          <div className="grid grid-3" style={{ gap: '20px' }}>
            {[
              { icon: '⚡', title: 'Same Day Delivery', desc: 'Urgent deliveries within hours across the UK' },
              { icon: '📦', title: 'Express / Next Day', desc: 'Reliable overnight shipping nationwide' },
              { icon: '📅', title: 'Scheduled Transport', desc: 'Plan ahead with our scheduled delivery service' },
              { icon: '🏗️', title: 'Pallet Transport', desc: 'Efficient pallet delivery for businesses' },
              { icon: '🚚', title: 'UK-EU Road Freight', desc: 'Cross-border transport solutions' },
              { icon: '🚐', title: 'Dedicated Van', desc: 'Exclusive van hire for your shipments' }
            ].map((service, index) => (
              <div key={index} style={{
                textAlign: 'center',
                padding: '28px 20px',
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '16px',
                transition: 'all 0.3s'
              }} className="service-card-dark">
                <div style={{ 
                  fontSize: '48px', 
                  marginBottom: '16px',
                  lineHeight: 1
                }}>{service.icon}</div>
                <h3 style={{ 
                  marginBottom: '10px',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#d4af37'
                }}>{service.title}</h3>
                <p style={{ 
                  fontSize: '14px', 
                  marginBottom: 0,
                  lineHeight: '1.5',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        .service-card-dark:hover {
          border-color: rgba(212, 175, 55, 0.5) !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.2) !important;
        }
      `}</style>

      {/* 7. INVOICE/PAYMENT SECTION */}
      <section style={{ 
        backgroundColor: '#050c16',
        padding: '60px 0',
        borderTop: '1px solid rgba(212, 175, 55, 0.1)'
      }}>
        <div className="container">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
              padding: '40px 32px',
              backgroundColor: 'rgba(10, 22, 40, 0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '20px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
              textAlign: 'center'
            }}>
              <h3 style={{ 
                color: '#d4af37', 
                fontSize: '24px', 
                fontWeight: '700',
                marginBottom: '20px'
              }}>Payment Options</h3>
              
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '16px',
                marginBottom: '28px',
                lineHeight: '1.6'
              }}>
                We offer flexible payment terms for business accounts
              </p>

              <div style={{ 
                display: 'flex', 
                gap: '24px', 
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: '28px'
              }}>
                <div style={{
                  flex: '1 1 250px',
                  padding: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏦</div>
                  <h4 style={{ color: '#00d4ff', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Bank Transfer</h4>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', marginBottom: 0 }}>Secure direct payments</p>
                </div>

                <div style={{
                  flex: '1 1 250px',
                  padding: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>💳</div>
                  <h4 style={{ color: '#00d4ff', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>PayPal</h4>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', marginBottom: 0 }}>Quick online payment</p>
                </div>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '10px'
              }}>
                <p style={{ color: '#d4af37', fontSize: '15px', fontWeight: '600', marginBottom: 0 }}>
                  ✓ 14/30 Day Payment Terms Available for Business Accounts
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ABOUT US - COMPACT */}
      <section id="about" style={{ 
        backgroundColor: '#0a1628',
        padding: '60px 0'
      }}>
        <div className="container">
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ 
                marginBottom: '16px',
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                color: '#ffffff',
                fontWeight: '800'
              }}>About Danny Courier</h2>
              <p style={{ 
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: '1.7',
                maxWidth: '700px',
                margin: '0 auto'
              }}>
                Established in 2021, Danny Courier Ltd has grown to become a trusted partner for 
                businesses and individuals across the UK and Europe.
              </p>
            </div>

            <div className="grid grid-2" style={{ gap: '24px' }}>
              <div style={{ 
                padding: '28px 24px',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '16px',
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                backdropFilter: 'blur(12px)'
              }}>
                <h3 style={{ 
                  marginBottom: '16px',
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#d4af37'
                }}>Why Choose Us</h3>
                <ul style={{ marginBottom: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                  <li style={{ paddingTop: '10px', paddingBottom: '10px' }}>Experienced UK & EU coverage with local expertise</li>
                  <li style={{ paddingTop: '10px', paddingBottom: '10px' }}>Comprehensive proof of delivery workflow</li>
                  <li style={{ paddingTop: '10px', paddingBottom: '10px' }}>Transparent pricing and payment terms</li>
                  <li style={{ paddingTop: '10px', paddingBottom: '10px' }}>Dedicated customer support team</li>
                </ul>
              </div>

              <div style={{ 
                padding: '28px 24px',
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(0, 212, 255, 0.1) 100%)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '16px',
                backdropFilter: 'blur(12px)'
              }}>
                <h3 style={{ 
                  color: '#00d4ff', 
                  marginBottom: '16px',
                  fontSize: '20px',
                  fontWeight: '700'
                }}>Our Commitment</h3>
                <p style={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  marginBottom: '16px',
                  lineHeight: '1.6',
                  fontSize: '14px'
                }}>
                  We are committed to providing reliable, professional transport services with a focus on:
                </p>
                <ul style={{ marginBottom: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                  <li style={{ paddingTop: '8px', paddingBottom: '8px' }}>On-time delivery performance</li>
                  <li style={{ paddingTop: '8px', paddingBottom: '8px' }}>Secure handling of goods</li>
                  <li style={{ paddingTop: '8px', paddingBottom: '8px' }}>Clear communication</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. LEGAL LINKS & COOKIE NOTICE */}
      <section style={{ 
        backgroundColor: '#050c16',
        padding: '40px 0',
        borderTop: '1px solid rgba(212, 175, 55, 0.1)'
      }}>
        <div className="container">
          <div style={{ 
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <div style={{ 
              display: 'flex', 
              gap: '24px', 
              justifyContent: 'center',
              flexWrap: 'wrap',
              fontSize: '14px'
            }}>
              <a href="#" style={{ 
                color: 'rgba(255, 255, 255, 0.7)', 
                textDecoration: 'none',
                borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
                paddingBottom: '2px',
                transition: 'color 0.2s'
              }} className="legal-link">Privacy Policy</a>
              <a href="#" style={{ 
                color: 'rgba(255, 255, 255, 0.7)', 
                textDecoration: 'none',
                borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
                paddingBottom: '2px',
                transition: 'color 0.2s'
              }} className="legal-link">Terms & Conditions</a>
              <a href="#" style={{ 
                color: 'rgba(255, 255, 255, 0.7)', 
                textDecoration: 'none',
                borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
                paddingBottom: '2px',
                transition: 'color 0.2s'
              }} className="legal-link">Payment Terms</a>
            </div>
          </div>
          
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '12px 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ 
              fontSize: '12px', 
              color: 'rgba(255, 255, 255, 0.5)', 
              marginBottom: 0 
            }}>
              🍪 This website uses cookies to enhance your experience
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .legal-link:hover {
          color: #d4af37 !important;
          border-color: #d4af37 !important;
        }
      `}</style>

      {/* 10. FOOTER - DARK WITH GOLD ACCENTS */}
      <footer style={{ 
        backgroundColor: '#0a1628',
        color: 'white',
        padding: '48px 0 24px',
        borderTop: '1px solid rgba(212, 175, 55, 0.2)'
      }}>
        <div className="container">
          <div style={{ 
            display: 'grid',
            gap: '32px',
            gridTemplateColumns: '1fr',
            marginBottom: '32px'
          }} className="footer-grid">
            <div>
              <h3 style={{ 
                color: '#d4af37', 
                fontSize: '22px', 
                marginBottom: '16px',
                fontWeight: '700'
              }}>
                Danny Courier Ltd
              </h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
                Professional courier and logistics services across the UK and Europe. 
                Established 2021.
              </p>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', marginBottom: '20px' }}>
                Payment Terms: 14/30 days for business accounts
              </p>

              {/* WhatsApp CTA in Footer */}
              <a 
                href={WHATSAPP_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                  color: '#0a1628',
                  borderRadius: '10px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  fontSize: '15px',
                  boxShadow: '0 4px 16px rgba(212, 175, 55, 0.4)',
                  transition: 'all 0.3s',
                  marginBottom: '16px'
                }}
                className="footer-whatsapp-btn"
              >
                <span style={{ fontSize: '20px' }}>💬</span> WhatsApp Us
              </a>

              {/* Social Media Icons */}
              <div>
                <div style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: '14px', 
                  marginBottom: '12px',
                  fontWeight: '600'
                }}>
                  Follow Us
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {SOCIAL_MEDIA_LINKS.map((social, idx) => (
                    <a 
                      key={idx}
                      href={social.url}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '1px solid rgba(212, 175, 55, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        transition: 'all 0.2s',
                        textDecoration: 'none'
                      }}
                      className="footer-social-icon"
                      aria-label={social.name}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#d4af37', fontSize: '16px', marginBottom: '16px', fontWeight: '700' }}>Quick Links</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a href="#home" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">Home</a>
                <a href="#services" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">Services</a>
                <a href="#about" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">About Us</a>
                <a href="#quote" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">Get Quote</a>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#d4af37', fontSize: '16px', marginBottom: '16px', fontWeight: '700' }}>Contact</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a href="tel:07423272138" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">
                  📞 07423 272 138
                </a>
                <a href="mailto:xdrivelogisticsltd@gmail.com" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s', wordBreak: 'break-word' }} className="footer-link">
                  📧 xdrivelogisticsltd@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div style={{ 
            borderTop: '1px solid rgba(212, 175, 55, 0.2)',
            paddingTop: '24px',
            textAlign: 'center'
          }}>
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none' }} className="footer-link">Privacy Policy</a>
              <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>•</span>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none' }} className="footer-link">Terms & Conditions</a>
              <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>•</span>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none' }} className="footer-link">Payment Terms</a>
            </div>
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', marginBottom: 0 }}>
              © {new Date().getFullYear()} Danny Courier Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 2fr 1fr 1fr !important;
          }
        }
        .footer-link:hover {
          color: #d4af37 !important;
        }
        .footer-social-icon:hover {
          border-color: #d4af37 !important;
          transform: scale(1.1);
        }
        .footer-whatsapp-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.6) !important;
        }
      `}</style>

      {/* 11. FLOATING WHATSAPP BUTTON - GOLD THEMED */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          boxShadow: '0 4px 20px rgba(212, 175, 55, 0.5)',
          zIndex: 999,
          transition: 'all 0.3s'
        }}
        aria-label="Contact us on WhatsApp"
        className="floating-whatsapp"
      >
        💬
      </a>

      <style jsx>{`
        .floating-whatsapp:hover {
          transform: scale(1.15);
          box-shadow: 0 6px 28px rgba(212, 175, 55, 0.7) !important;
        }
      `}</style>
    </main>
  );
}
