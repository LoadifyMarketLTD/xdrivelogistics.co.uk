'use client';

import { useState } from 'react';
import Image from 'next/image';
import { COMPANY_CONFIG } from './config/company';
import { THEME, glassStyle, goldButton, greenButton, whatsappButton, darkGlassButton } from './config/theme';

const WHATSAPP_URL = `https://wa.me/${COMPANY_CONFIG.whatsapp.number}?text=${encodeURIComponent(COMPANY_CONFIG.whatsapp.defaultMessage)}`;

const SOCIAL_MEDIA_LINKS = [
  { name: 'Facebook', icon: '📘', url: COMPANY_CONFIG.social.facebook },
  { name: 'Instagram', icon: '📷', url: COMPANY_CONFIG.social.instagram },
  { name: 'TikTok', icon: '🎵', url: COMPANY_CONFIG.social.tiktok }
];

const SERVICES = [
  {
    title: 'Express Courier',
    description: 'Urgent same-day deliveries across the UK',
    icon: '⚡'
  },
  {
    title: 'Pallet & Freight',
    description: 'Secure pallet transport with professional handling',
    icon: '📦'
  },
  {
    title: 'UK & EU Transport',
    description: 'Reliable cross-border road freight throughout Europe',
    icon: '🌍'
  }
];

const WHY_XDRIVE = [
  '24/7 Availability',
  'Fast Response Time',
  'Fully Insured',
  'Professional Drivers',
  'Real-Time Communication'
];

const TRUSTED_PARTNERS = [
  'Amazon',
  'Construct',
  'Buildex',
  'CityExpress'
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  const handleQuoteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    console.log('Quote Form Submitted:', Object.fromEntries(formData));
    setQuoteSuccess(true);
    e.currentTarget.reset();
    setTimeout(() => {
      setQuoteSuccess(false);
      setQuoteModalOpen(false);
    }, 3000);
  };

  return (
    <main style={{ 
      backgroundColor: THEME.colors.primary.dark, 
      minHeight: '100vh',
      color: THEME.colors.text.primary,
      fontFamily: THEME.typography.fonts.body
    }}>
      {/* HEADER - Fixed Navigation Bar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: THEME.colors.primary.dark,
        height: '64px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          {/* Logo */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '0px'
          }}>
            <div style={{ 
              fontSize: '28px', 
              fontWeight: 800,
              fontStyle: 'italic',
              color: THEME.colors.text.primary,
              letterSpacing: '0px',
              lineHeight: '1'
            }}>
              <span style={{ color: THEME.colors.gold.primary, fontSize: '32px' }}>X</span>
              <span>Drive</span>
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginTop: '-2px'
            }}>
              Logistics
            </div>
          </div>

          {/* Desktop Navigation */}
          <div style={{ 
            display: 'none',
            gap: '32px',
            alignItems: 'center'
          }} className="desktop-nav">
            <a href="#home" style={{ 
              fontWeight: 500, 
              color: 'rgba(255, 255, 255, 0.85)', 
              transition: 'color 0.3s ease',
              textDecoration: 'none',
              fontSize: '15px'
            }} className="nav-link">Home</a>
            <a href="#services" style={{ 
              fontWeight: 500, 
              color: 'rgba(255, 255, 255, 0.85)', 
              transition: 'color 0.3s ease',
              textDecoration: 'none',
              fontSize: '15px'
            }} className="nav-link">Services</a>
            <a href="#about" style={{ 
              fontWeight: 500, 
              color: 'rgba(255, 255, 255, 0.85)', 
              transition: 'color 0.3s ease',
              textDecoration: 'none',
              fontSize: '15px'
            }} className="nav-link">About</a>
            <a href="#contact" style={{ 
              fontWeight: 500, 
              color: 'rgba(255, 255, 255, 0.85)', 
              transition: 'color 0.3s ease',
              textDecoration: 'none',
              fontSize: '15px'
            }} className="nav-link">Contact</a>
            
            {/* Desktop CTA Button */}
            <button 
              onClick={() => setQuoteModalOpen(true)}
              style={{
                height: '40px',
                padding: '0 20px',
                backgroundColor: THEME.colors.green.primary,
                color: THEME.colors.text.primary,
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              className="desktop-cta-btn"
            >
              Request a Quote
            </button>
          </div>

          {/* Right Side - Hamburger for Mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

            {/* Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: 'center'
              }}
              className="mobile-menu-btn"
            >
              <div style={{ width: '24px', height: '2px', backgroundColor: 'white' }}></div>
              <div style={{ width: '24px', height: '2px', backgroundColor: 'white' }}></div>
              <div style={{ width: '24px', height: '2px', backgroundColor: 'white' }}></div>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div style={{
            backgroundColor: THEME.colors.primary.dark,
            position: 'absolute',
            top: '64px',
            left: 0,
            right: 0,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <a href="#home" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 500,
              padding: '12px 0'
            }}>Home</a>
            <a href="#services" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 500,
              padding: '12px 0'
            }}>Services</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 500,
              padding: '12px 0'
            }}>About</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 500,
              padding: '12px 0'
            }}>Contact</a>
            <button 
              onClick={() => { setQuoteModalOpen(true); setMobileMenuOpen(false); }}
              style={{
                marginTop: '12px',
                height: '48px',
                backgroundColor: THEME.colors.green.primary,
                color: THEME.colors.text.primary,
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Get a Quote
            </button>
          </div>
        )}
      </nav>

      {/* HERO SECTION - Cinematic with Truck Image */}
      <section id="home" style={{
        minHeight: '520px',
        display: 'flex',
        alignItems: 'center',
        background: `linear-gradient(135deg, rgba(14, 26, 43, 0.88) 0%, rgba(31, 58, 95, 0.75) 100%), url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&q=80) center/cover`,
        position: 'relative',
        padding: '120px 24px 60px',
      }}>
        <div className="container" style={{ 
          position: 'relative', 
          zIndex: 1,
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ maxWidth: '600px' }}>
            <h1 style={{ 
              color: THEME.colors.text.primary,
              marginBottom: '32px', 
              lineHeight: '1.1',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              DRIVING <span style={{ color: THEME.colors.gold.primary }}>EXCELLENCE</span>
              <br />
              IN LOGISTICS
            </h1>
            
            <p style={{ 
              fontSize: '17px', 
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '32px',
              lineHeight: '1.6'
            }}>
              Fast · Secure · Reliable UK & EU Transport
            </p>
            
            {/* Hero CTAs */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '14px',
              alignItems: 'center'
            }}>
              <button 
                onClick={() => setQuoteModalOpen(true)}
                style={{ 
                  height: '48px',
                  padding: '0 28px',
                  background: THEME.colors.gold.primary,
                  color: THEME.colors.primary.dark,
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textTransform: 'none'
                }} 
                className="hero-gold-btn"
              >
                Request a Quote
              </button>
              
              <a 
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  height: '48px',
                  padding: '0 28px',
                  background: THEME.colors.green.whatsapp,
                  color: THEME.colors.text.primary,
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }} 
                className="hero-whatsapp-btn"
              >
                <span style={{ fontSize: '20px' }}>💬</span>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Services + Why XDrive (Two Column Layout) */}
      <section id="services" style={{ 
        backgroundColor: THEME.colors.primary.navy,
        padding: '64px 24px',
        position: 'relative'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '48px'
          }} className="services-grid">
            {/* LEFT: OUR SERVICES */}
            <div>
              <h2 style={{ 
                fontSize: '14px', 
                fontWeight: 700,
                color: THEME.colors.gold.primary,
                marginBottom: '24px',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                OUR SERVICES
              </h2>
              
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {SERVICES.map((service, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '24px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    transition: 'all 0.3s ease'
                  }} className="service-card">
                    <div style={{ 
                      width: '48px',
                      height: '48px',
                      minWidth: '48px',
                      borderRadius: '10px',
                      background: THEME.colors.gold.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      color: THEME.colors.primary.dark
                    }}>{service.icon}</div>
                    <div>
                      <h3 style={{ 
                        fontSize: '17px', 
                        fontWeight: 700, 
                        color: THEME.colors.text.primary,
                        marginBottom: '4px'
                      }}>{service.title}</h3>
                      <p style={{ 
                        fontSize: '14px', 
                        color: 'rgba(255, 255, 255, 0.65)',
                        lineHeight: '1.5',
                        margin: 0
                      }}>{service.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: WHY XDRIVE */}
            <div>
              <h2 style={{ 
                fontSize: '14px', 
                fontWeight: 700,
                color: THEME.colors.gold.primary,
                marginBottom: '24px',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                WHY XDRIVE
              </h2>
              
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                {WHY_XDRIVE.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                  }}>
                    <div style={{ 
                      width: '28px',
                      height: '28px',
                      minWidth: '28px',
                      borderRadius: '50%',
                      background: THEME.colors.green.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: THEME.colors.text.primary,
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>✓</div>
                    <span style={{ 
                      fontSize: '16px',
                      fontWeight: 600,
                      color: THEME.colors.text.primary
                    }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: TRUSTED BY UK BUSINESSES */}
      <section style={{ 
        backgroundColor: THEME.colors.background.light,
        padding: '40px 24px',
        borderTop: '1px solid rgba(31, 58, 95, 0.08)',
        borderBottom: '1px solid rgba(31, 58, 95, 0.08)'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: '12px', 
            fontWeight: 700,
            color: THEME.colors.text.dark,
            marginBottom: '24px',
            textTransform: 'uppercase',
            letterSpacing: '3px'
          }}>
            TRUSTED BY UK BUSINESSES
          </h3>
          
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '40px'
          }}>
            <div style={{ 
              fontSize: '22px',
              fontWeight: 700,
              color: THEME.colors.primary.navy,
              opacity: 0.55,
              fontStyle: 'italic',
              textTransform: 'lowercase'
            }}>amazon</div>
            <div style={{ 
              fontSize: '16px',
              fontWeight: 700,
              color: THEME.colors.primary.navy,
              opacity: 0.55,
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>CONSTRUCT</div>
            <div style={{ 
              fontSize: '16px',
              fontWeight: 700,
              color: THEME.colors.primary.navy,
              opacity: 0.55,
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>BUILDEX</div>
            <div style={{ 
              fontSize: '16px',
              fontWeight: 700,
              color: THEME.colors.primary.navy,
              opacity: 0.55,
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>CITYEXPRESS</div>
          </div>
        </div>
      </section>
              color: THEME.colors.text.secondary
            }}>E-Commerce</div>
          </div>
        </div>
      </section>

      {/* SECTION 5: READY TO MOVE YOUR FREIGHT CTA */}
      <section style={{ 
        backgroundColor: THEME.colors.primary.navy,
        padding: '64px 24px',
        textAlign: 'center'
      }}>
        <div className="container" style={{ 
          maxWidth: '700px',
          margin: '0 auto'
        }}>
          <h2 style={{ 
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', 
            fontWeight: 700,
            color: THEME.colors.text.primary,
            marginBottom: '12px'
          }}>
            Ready to Move Your Freight?
          </h2>
          
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.75)',
            marginBottom: '32px'
          }}>
            Fast quote in under 100 minutes
          </p>
          
          <a 
            href={`mailto:${COMPANY_CONFIG.email}?subject=Instant Quote Request`}
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '54px',
              padding: '0 40px',
              background: THEME.colors.green.primary,
              color: THEME.colors.text.primary,
              border: 'none',
              borderRadius: '8px',
              fontSize: '17px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(46, 125, 50, 0.35)'
            }} 
            className="cta-quote-btn"
          >
            Get Instant Quote
          </a>
        </div>
      </section>

      {/* SECTION 6: Contact Information Bar */}
      <section style={{ 
        backgroundColor: THEME.colors.background.light,
        padding: '40px 24px'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '32px'
        }}>
          {/* Phone */}
          <a href={`tel:${COMPANY_CONFIG.phone}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: THEME.colors.primary.navy,
            fontSize: '16px',
            fontWeight: 600
          }}>
            <span style={{ fontSize: '20px' }}>📞</span>
            {COMPANY_CONFIG.phoneDisplay}
          </a>
          
          {/* Email */}
          <a href={`mailto:${COMPANY_CONFIG.email}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: THEME.colors.primary.navy,
            fontSize: '16px',
            fontWeight: 600
          }}>
            <span style={{ fontSize: '20px' }}>✉️</span>
            {COMPANY_CONFIG.email}
          </a>
        </div>
      </section>

      {/* SECTION 7: Footer */}
      <footer id="contact" style={{ 
        backgroundColor: THEME.colors.primary.dark,
        padding: '40px 24px 20px'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          {/* Top Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            paddingBottom: '24px',
            marginBottom: '24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Logo */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '0px'
            }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 800,
                fontStyle: 'italic',
                color: THEME.colors.text.primary,
                lineHeight: '1'
              }}>
                <span style={{ color: THEME.colors.gold.primary, fontSize: '28px' }}>X</span>
                <span>Drive</span>
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.5)',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginTop: '-2px'
              }}>
                Logistics
              </div>
            </div>
            
            {/* Navigation Links */}
            <div style={{
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap'
            }}>
              <a href="#home" style={{ 
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}>Home</a>
              <a href="#services" style={{ 
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}>Services</a>
              <a href="#contact" style={{ 
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}>Contact</a>
            </div>
          </div>

          {/* Bottom Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.45)'
          }}>
            <div>XDrive Logistics Ltd</div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span>© 2026 XDrive Logistics Ltd</span>
              <a href="/privacy" style={{ 
                color: 'rgba(255, 255, 255, 0.45)',
                textDecoration: 'none'
              }}>Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* SECTION 8: Floating WhatsApp Button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: THEME.colors.green.whatsapp,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 4px 16px rgba(37, 211, 102, 0.4)',
          zIndex: 999,
          transition: 'all 0.3s ease',
          textDecoration: 'none'
        }}
        className="floating-whatsapp"
      >
        💬
      </a>

      {/* MOBILE STICKY CONTACT BAR */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        ...glassStyle('dark'),
        padding: '16px 24px',
        display: 'none',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 999,
        borderTop: `1px solid ${THEME.colors.border.gold}`
      }} className="mobile-sticky-bar">
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          textDecoration: 'none',
          color: THEME.colors.text.primary,
          fontSize: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>💬</span>
          <span>WhatsApp</span>
        </a>

        <a href={`tel:${COMPANY_CONFIG.phone}`} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          textDecoration: 'none',
          color: THEME.colors.text.primary,
          fontSize: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>📞</span>
          <span>Call</span>
        </a>

        <a href={`mailto:${COMPANY_CONFIG.email}`} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          textDecoration: 'none',
          color: THEME.colors.text.primary,
          fontSize: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>📧</span>
          <span>Email</span>
        </a>
      </div>

      {/* QUOTE MODAL */}
      {quoteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '24px'
        }} onClick={() => setQuoteModalOpen(false)}>
          <div style={{
            ...glassStyle('medium'),
            maxWidth: '600px',
            width: '100%',
            borderRadius: THEME.borderRadius.xl,
            padding: '40px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px'
            }}>
              <h2 style={{
                fontSize: '32px',
                fontWeight: THEME.typography.weights.bold,
                color: THEME.colors.text.primary,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>Get a <span style={{ color: THEME.colors.gold.primary }}>Quote</span></h2>
              <button
                onClick={() => setQuoteModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '32px',
                  cursor: 'pointer',
                  color: THEME.colors.text.primary,
                  lineHeight: 1
                }}
              >×</button>
            </div>

            {quoteSuccess ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: THEME.colors.gold.primary,
                fontSize: '20px'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>✓</div>
                <p style={{ fontWeight: THEME.typography.weights.bold }}>Quote Request Sent!</p>
                <p style={{ color: THEME.colors.text.secondary, marginTop: '12px' }}>We'll get back to you within 1 hour.</p>
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div>
                  <label htmlFor="quote-name" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Full Name *</label>
                  <input
                    id="quote-name"
                    type="text"
                    name="name"
                    required
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none'
                    }}
                    className="form-input"
                  />
                </div>

                <div>
                  <label htmlFor="quote-email" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Email *</label>
                  <input
                    id="quote-email"
                    type="email"
                    name="email"
                    required
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none'
                    }}
                    className="form-input"
                  />
                </div>

                <div>
                  <label htmlFor="quote-phone" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Phone</label>
                  <input
                    id="quote-phone"
                    type="tel"
                    name="phone"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none'
                    }}
                    className="form-input"
                  />
                </div>

                <div>
                  <label htmlFor="quote-pickup" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Pickup Location *</label>
                  <input
                    id="quote-pickup"
                    type="text"
                    name="pickup"
                    required
                    placeholder="e.g., London, UK"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none'
                    }}
                    className="form-input"
                  />
                </div>

                <div>
                  <label htmlFor="quote-delivery" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Delivery Location *</label>
                  <input
                    id="quote-delivery"
                    type="text"
                    name="delivery"
                    required
                    placeholder="e.g., Paris, France"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none'
                    }}
                    className="form-input"
                  />
                </div>

                <div>
                  <label htmlFor="quote-cargo" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Cargo Type *</label>
                  <select
                    id="quote-cargo"
                    name="cargoType"
                    required
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none'
                    }}
                    className="form-input"
                  >
                    <option value="" style={{ background: THEME.colors.primary.dark }}>Select cargo type</option>
                    <option value="pallets" style={{ background: THEME.colors.primary.dark }}>Pallets</option>
                    <option value="parcels" style={{ background: THEME.colors.primary.dark }}>Parcels</option>
                    <option value="furniture" style={{ background: THEME.colors.primary.dark }}>Furniture</option>
                    <option value="documents" style={{ background: THEME.colors.primary.dark }}>Documents</option>
                    <option value="other" style={{ background: THEME.colors.primary.dark }}>Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="quote-notes" style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: THEME.typography.weights.semibold,
                    color: THEME.colors.text.primary,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Additional Details</label>
                  <textarea
                    id="quote-notes"
                    name="notes"
                    rows={4}
                    placeholder="Weight, dimensions, special requirements..."
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: THEME.borderRadius.md,
                      border: `1px solid ${THEME.colors.border.light}`,
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: THEME.colors.text.primary,
                      fontSize: '16px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    className="form-input"
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    ...goldButton,
                    width: '100%',
                    height: '56px',
                    marginTop: '16px'
                  }}
                  className="gold-btn"
                >
                  Submit Quote Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STYLES */}
      <style jsx>{`
        .container {
          width: 100%;
        }
        
        /* Responsive Breakpoints */
        @media (min-width: 1024px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
          .desktop-cta-btn {
            display: block !important;
          }
        }
        
        @media (min-width: 768px) {
          .services-grid {
            grid-template-columns: 1.2fr 0.8fr !important;
          }
        }

        @media (max-width: 1023px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .desktop-cta-btn {
            display: none !important;
          }
        }

        @media (max-width: 767px) {
          .mobile-sticky-bar {
            display: flex !important;
          }
        }
        
        /* Hover States */
        .nav-link:hover {
          color: ${THEME.colors.gold.primary} !important;
        }
        
        .desktop-cta-btn:hover {
          background-color: ${THEME.colors.green.dark} !important;
        }
        
        .hero-gold-btn:hover {
          background: ${THEME.colors.gold.dark} !important;
          transform: translateY(-2px);
        }
        
        .hero-whatsapp-btn:hover {
          background: ${THEME.colors.green.whatsappHover} !important;
          transform: translateY(-2px);
        }
        
        .cta-quote-btn:hover {
          background: ${THEME.colors.green.dark} !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(46, 125, 50, 0.45) !important;
        }
        
        .floating-whatsapp:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.5) !important;
        }
        
        .service-card:hover {
          background: rgba(255, 255, 255, 0.12) !important;
        }
        
        .form-input:focus {
          border-color: ${THEME.colors.gold.primary} !important;
          box-shadow: 0 0 0 2px ${THEME.colors.gold.primary}40 !important;
        }
      `}</style>
        }
      `}</style>
    </main>
  );
}
