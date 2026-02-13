'use client';

import { useState } from 'react';

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
    <main>
      {/* 1. NAVIGATION (STICKY) */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'white',
        borderBottom: '1px solid var(--color-border)',
        height: '56px'
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
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary)'
          }}>
            Danny Courier Ltd
          </div>

          {/* Desktop Navigation */}
          <div style={{ 
            display: 'none',
            gap: '32px',
            alignItems: 'center'
          }} className="desktop-nav">
            <a href="#home" style={{ fontWeight: 'var(--font-weight-medium)' }}>Home</a>
            <a href="#services" style={{ fontWeight: 'var(--font-weight-medium)' }}>Services</a>
            <a href="#about" style={{ fontWeight: 'var(--font-weight-medium)' }}>About Us</a>
            <a href="#contact" style={{ fontWeight: 'var(--font-weight-medium)' }}>Contact</a>
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
                    background: language === lang ? 'var(--color-secondary)' : 'transparent',
                    color: language === lang ? 'white' : 'var(--color-text-muted)',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'var(--font-weight-medium)',
                    fontSize: '13px'
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* CTA Button - Desktop Only */}
            <a href="#quote" className="btn btn-primary" style={{ 
              display: 'none',
              height: '40px',
              padding: '0 20px',
              fontSize: '14px'
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
              <span style={{ width: '24px', height: '2px', backgroundColor: 'var(--color-primary)' }}></span>
              <span style={{ width: '24px', height: '2px', backgroundColor: 'var(--color-primary)' }}></span>
              <span style={{ width: '24px', height: '2px', backgroundColor: 'var(--color-primary)' }}></span>
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
            backgroundColor: 'white',
            borderBottom: '1px solid var(--color-border)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="#home" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: 'var(--font-weight-medium)' }}>Home</a>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: 'var(--font-weight-medium)' }}>Services</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: 'var(--font-weight-medium)' }}>About Us</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: 'var(--font-weight-medium)' }}>Contact</a>
              <a href="#quote" className="btn btn-primary" style={{ marginTop: '8px' }}>Get a Quote</a>
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
      `}</style>

      {/* 2. HERO SECTION */}
      <section id="home" style={{
        minHeight: '500px',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        color: 'white',
        position: 'relative',
        padding: '80px 0'
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.2) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>
        
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '50px',
              fontSize: '14px',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: '24px',
              color: '#6ee7b7'
            }}>
              🚚 Available 24/7 Across UK & Europe
            </div>
            
            <h1 style={{ 
              color: 'white', 
              marginBottom: '20px', 
              lineHeight: '1.1',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 'var(--font-weight-bold)',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              Reliable Same Day & Express Transport
            </h1>
            
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 3vw, 2rem)', 
              fontWeight: 'var(--font-weight-semibold)',
              color: 'rgba(255, 255, 255, 0.95)',
              marginBottom: '24px',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              Across the UK & Europe
            </h2>
            
            <p style={{ 
              fontSize: 'clamp(16px, 2vw, 20px)', 
              marginBottom: '40px',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.6',
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
              <a href="#quote" className="btn btn-primary" style={{ 
                height: '56px', 
                fontSize: '17px',
                padding: '0 32px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                fontWeight: 'var(--font-weight-bold)'
              }}>
                📦 Get a Free Quote
              </a>
              <a href="tel:07423272138" className="btn" style={{ 
                height: '56px',
                fontSize: '17px',
                padding: '0 32px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                fontWeight: 'var(--font-weight-semibold)'
              }}>
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
              fontSize: '15px', 
              color: 'rgba(255, 255, 255, 0.85)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📧</span>
                <a href="mailto:xdrivelogisticsltd@gmail.com" style={{ 
                  color: 'white', 
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.4)',
                  paddingBottom: '2px'
                }}>
                  xdrivelogisticsltd@gmail.com
                </a>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px'
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
            min-height: 560px !important;
          }
        }
        @media (min-width: 1024px) {
          #home {
            min-height: 600px !important;
          }
        }
        .btn:hover {
          transform: translateY(-2px);
        }
      `}</style>

      {/* 3. BENEFITS STRIP */}
      <section style={{ 
        backgroundColor: 'white',
        padding: 'var(--section-padding) 0'
      }}>
        <div className="container">
          <div className="grid grid-3" style={{ textAlign: 'center' }}>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🕐</div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>24/7 Service</h3>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: 0 }}>
                Round-the-clock availability
              </p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌍</div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Nationwide & Europe</h3>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: 0 }}>
                UK and EU coverage
              </p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🛡️</div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Fully Insured</h3>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: 0 }}>
                Your cargo is protected
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. QUICK QUOTE SECTION */}
      <section id="quote" style={{ backgroundColor: 'var(--color-light-bg)' }}>
        <div className="container">
          <h2 className="text-center" style={{ marginBottom: '40px' }}>Get Your Quote Today</h2>
          
          <div style={{ 
            display: 'grid',
            gap: '32px',
            gridTemplateColumns: '1fr'
          }} className="quote-grid">
            {/* Quote Form */}
            <div className="card" style={{ maxWidth: '740px', margin: '0 auto', width: '100%' }}>
              <h3 style={{ marginBottom: '24px' }}>Get a Quick Quote</h3>
              
              {quoteSuccess && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-cta)',
                  color: 'white',
                  borderRadius: 'var(--input-radius)',
                  marginBottom: '16px',
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
                      <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                        Name *
                      </label>
                      <input type="text" id="name" name="name" required placeholder="Your full name" />
                    </div>
                    <div>
                      <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                        Email *
                      </label>
                      <input type="email" id="email" name="email" required placeholder="your.email@example.com" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="form-row">
                    <div>
                      <label htmlFor="pickup" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                        Pickup Location *
                      </label>
                      <input type="text" id="pickup" name="pickup" required placeholder="City, Postcode, or Address" />
                    </div>
                    <div>
                      <label htmlFor="delivery" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                        Delivery Location *
                      </label>
                      <input type="text" id="delivery" name="delivery" required placeholder="City, Postcode, or Address" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="form-row">
                    <div>
                      <label htmlFor="cargo" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                        Cargo Details *
                      </label>
                      <select id="cargo" name="cargo" required>
                        <option value="">Select cargo type</option>
                        <option value="documents">Documents / Small Parcel</option>
                        <option value="packages">Packages (up to 30kg)</option>
                        <option value="pallets">Pallets</option>
                        <option value="large">Large Items / Furniture</option>
                        <option value="other">Other (specify in message)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="quantity" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                        Quantity
                      </label>
                      <input type="number" id="quantity" name="quantity" min="1" defaultValue="1" placeholder="Number of items" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                      Additional Details
                    </label>
                    <textarea 
                      id="message" 
                      name="message" 
                      placeholder="Any special requirements or additional information..."
                      rows={3}
                    ></textarea>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ minWidth: '200px' }}>
                      Request a Quote
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Image Card */}
            <div className="card" style={{ 
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage: 'url(/placeholder-logistics.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}>
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <h3 style={{ color: 'white', marginBottom: '16px' }}>Fast Response Time</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: 0 }}>
                  We typically respond to quote requests within 1 hour during business hours
                </p>
              </div>
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
              href="https://wa.me/447423272138" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ backgroundColor: '#25D366', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span style={{ fontSize: '20px' }}>💬</span> WhatsApp
            </a>
            <a 
              href="mailto:xdrivelogisticsltd@gmail.com"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span style={{ fontSize: '20px' }}>📧</span> Email Us
            </a>
            <a 
              href="tel:07423272138"
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
        @media (min-width: 1024px) {
          .quote-grid {
            grid-template-columns: 1.8fr 1fr !important;
          }
        }
      `}</style>

      {/* 5. SERVICES SECTION */}
      <section id="services" style={{ backgroundColor: 'white' }}>
        <div className="container">
          <h2 className="text-center" style={{ marginBottom: '16px' }}>Our Services</h2>
          <p className="text-center text-muted" style={{ marginBottom: '40px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            Comprehensive transport solutions tailored to your needs
          </p>

          <div className="grid grid-3">
            {[
              { icon: '⚡', title: 'Same Day Delivery', desc: 'Urgent deliveries within hours across the UK' },
              { icon: '📦', title: 'Express / Next Day', desc: 'Reliable overnight shipping nationwide' },
              { icon: '📅', title: 'Scheduled Transport', desc: 'Plan ahead with our scheduled delivery service' },
              { icon: '🏗️', title: 'Pallet Transport', desc: 'Efficient pallet delivery for businesses' },
              { icon: '🚚', title: 'UK-EU Road Freight', desc: 'Cross-border transport solutions' },
              { icon: '🚐', title: 'Dedicated Van', desc: 'Exclusive van hire for your shipments' }
            ].map((service, index) => (
              <div key={index} className="card">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>{service.icon}</div>
                <h3 style={{ marginBottom: '12px' }}>{service.title}</h3>
                <p className="text-muted" style={{ fontSize: '14px', marginBottom: 0 }}>
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. ABOUT US SECTION */}
      <section id="about" style={{ backgroundColor: 'var(--color-light-bg)' }}>
        <div className="container">
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 className="text-center" style={{ marginBottom: '24px' }}>About Danny Courier</h2>
            <p className="text-center" style={{ fontSize: '17px', marginBottom: '40px' }}>
              Established in 2021, Danny Courier Ltd has grown to become a trusted partner for 
              businesses and individuals across the UK and Europe.
            </p>

            <div className="grid grid-2" style={{ gap: '32px' }}>
              <div className="card" style={{ border: '2px solid var(--color-border)' }}>
                <h3 style={{ marginBottom: '16px' }}>Why Choose Us</h3>
                <ul style={{ marginBottom: 0 }}>
                  <li>Experienced UK & EU coverage with local expertise</li>
                  <li>Comprehensive proof of delivery workflow</li>
                  <li>Transparent pricing and payment terms</li>
                  <li>Dedicated customer support team</li>
                </ul>
              </div>

              <div className="card" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                <h3 style={{ color: 'white', marginBottom: '16px' }}>Our Commitment</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '16px' }}>
                  We are committed to providing reliable, professional transport services with a focus on:
                </p>
                <ul style={{ marginBottom: 0 }}>
                  <li style={{ color: 'rgba(255, 255, 255, 0.95)' }}>On-time delivery performance</li>
                  <li style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Secure handling of goods</li>
                  <li style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Clear communication</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CONTACT SECTION */}
      <section id="contact" style={{ backgroundColor: 'white' }}>
        <div className="container">
          <h2 className="text-center" style={{ marginBottom: '40px' }}>Get In Touch</h2>

          <div style={{ 
            display: 'grid',
            gap: '32px',
            gridTemplateColumns: '1fr'
          }} className="contact-grid">
            {/* Contact Details */}
            <div className="card">
              <h3 style={{ marginBottom: '24px' }}>Contact Information</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📞</span> Phone
                  </div>
                  <a href="tel:07423272138" style={{ fontSize: '18px' }}>07423 272 138</a>
                </div>

                <div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📧</span> Email
                  </div>
                  <a href="mailto:xdrivelogisticsltd@gmail.com">xdrivelogisticsltd@gmail.com</a>
                </div>

                <div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '12px' }}>
                    Follow Us
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {/* TODO: Replace with actual Danny Courier social media URLs */}
                    <a 
                      href="#facebook" 
                      onClick={(e) => e.preventDefault()}
                      style={{ 
                        fontSize: '32px',
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }}
                      aria-label="Facebook (Coming Soon)"
                      title="Coming Soon"
                    >
                      📘
                    </a>
                    <a 
                      href="#instagram" 
                      onClick={(e) => e.preventDefault()}
                      style={{ 
                        fontSize: '32px',
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }}
                      aria-label="Instagram (Coming Soon)"
                      title="Coming Soon"
                    >
                      📷
                    </a>
                    <a 
                      href="#tiktok" 
                      onClick={(e) => e.preventDefault()}
                      style={{ 
                        fontSize: '32px',
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }}
                      aria-label="TikTok (Coming Soon)"
                      title="Coming Soon"
                    >
                      🎵
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="card">
              <h3 style={{ marginBottom: '24px' }}>Send Us a Message</h3>
              
              {contactSuccess && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-cta)',
                  color: 'white',
                  borderRadius: 'var(--input-radius)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>✓</span>
                  <span>Message sent! We will get back to you soon.</span>
                </div>
              )}

              <form onSubmit={handleContactSubmit}>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label htmlFor="contact-name" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                      Name *
                    </label>
                    <input type="text" id="contact-name" name="name" required placeholder="Your name" />
                  </div>

                  <div>
                    <label htmlFor="contact-email" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                      Email *
                    </label>
                    <input type="email" id="contact-email" name="email" required placeholder="your.email@example.com" />
                  </div>

                  <div>
                    <label htmlFor="contact-phone" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                      Phone
                    </label>
                    <input type="tel" id="contact-phone" name="phone" placeholder="Your phone number" />
                  </div>

                  <div>
                    <label htmlFor="contact-message" style={{ display: 'block', marginBottom: '8px', fontWeight: 'var(--font-weight-medium)' }}>
                      Message *
                    </label>
                    <textarea 
                      id="contact-message" 
                      name="message" 
                      required
                      placeholder="How can we help you?"
                      rows={4}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (min-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

      {/* 8. FOOTER */}
      <footer style={{ 
        backgroundColor: 'var(--color-primary)',
        color: 'white',
        padding: '32px 0 24px'
      }}>
        <div className="container">
          <div style={{ 
            display: 'grid',
            gap: '32px',
            gridTemplateColumns: '1fr',
            marginBottom: '24px'
          }} className="footer-grid">
            <div>
              <h3 style={{ color: 'white', fontSize: '20px', marginBottom: '12px' }}>
                Danny Courier Ltd
              </h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', marginBottom: '16px' }}>
                Professional courier and logistics services across the UK and Europe. 
                Established 2021.
              </p>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', marginBottom: 0 }}>
                Payment Terms: 14/30 days for business accounts
              </p>
            </div>

            <div>
              <h4 style={{ color: 'white', fontSize: '16px', marginBottom: '12px' }}>Quick Links</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a href="#home" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>Home</a>
                <a href="#services" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>Services</a>
                <a href="#about" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>About Us</a>
                <a href="#contact" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>Contact</a>
              </div>
            </div>

            <div>
              <h4 style={{ color: 'white', fontSize: '16px', marginBottom: '12px' }}>Contact</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a href="tel:07423272138" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                  📞 07423 272 138
                </a>
                <a href="mailto:xdrivelogisticsltd@gmail.com" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                  📧 xdrivelogisticsltd@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            paddingTop: '20px',
            textAlign: 'center'
          }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px', marginBottom: 0 }}>
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
      `}</style>

      {/* 9. FLOATING WHATSAPP BUTTON */}
      <a
        href="https://wa.me/447423272138"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          backgroundColor: '#25D366',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          zIndex: 999,
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        aria-label="Contact us on WhatsApp"
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
        }}
      >
        💬
      </a>
    </main>
  );
}
