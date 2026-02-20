'use client';

import { useState } from 'react';
import { COMPANY_CONFIG } from './config/company';
import { THEME } from './config/theme';

const WHATSAPP_URL = `https://wa.me/${COMPANY_CONFIG.whatsapp.number}?text=${encodeURIComponent(COMPANY_CONFIG.whatsapp.defaultMessage)}`;

const SERVICES = [
  {
    title: 'Express Courier',
    description: 'Rapid same-day deliveries',
    icon: '⚡'
  },
  {
    title: 'Pallet & Freight',
    description: 'Secure pallet and freight shipping',
    icon: '📦'
  },
  {
    title: 'UK & EU Transport',
    description: 'Reliable transport across UK & Europe',
    icon: '🌍'
  }
];

const WHY_DANNY_COURIER = [
  '24/7 Availability',
  'Fast Response Time',
  'Fully Insured',
  'Professional Drivers',
  'Real-Time Communication'
];

const TRUSTED_PARTNERS = [
  { name: 'amazon', style: { fontStyle: 'italic', textTransform: 'lowercase' as const } },
  { name: 'ROYAL MAIL', style: { fontWeight: 700, letterSpacing: '2px' } },
  { name: 'BUILDEX', style: { fontWeight: 600 } },
  { name: 'CITY EXPRESS', style: { fontWeight: 600 } }
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
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>

      <main style={{ 
        backgroundColor: THEME.colors.background.dark, 
        minHeight: '100vh',
        color: THEME.colors.text.primary,
        fontFamily: THEME.typography.fonts.body
      }}>
        {/* HEADER - Fixed Navigation */}
        <nav style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: THEME.colors.primary.dark,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '70px',
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 24px'
          }}>
            {/* Logo */}
            <div style={{ 
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>
              <span style={{ color: THEME.colors.gold.primary }}>X</span>
              <span style={{ color: THEME.colors.text.primary }}>Drive</span>
            </div>

            {/* Desktop Navigation */}
            <div style={{ 
              display: 'none',
              gap: '32px',
              alignItems: 'center'
            }} className="desktop-nav">
              <a href="#home" style={{ 
                color: THEME.colors.text.secondary, 
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'color 0.3s ease'
              }}>Home</a>
              <a href="#services" style={{ 
                color: THEME.colors.text.secondary, 
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'color 0.3s ease'
              }}>Services</a>
              <a href="#contact" style={{ 
                color: THEME.colors.text.secondary, 
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'color 0.3s ease'
              }}>Contact</a>
              <button
                onClick={() => setQuoteModalOpen(true)}
                style={{
                  backgroundColor: THEME.colors.gold.primary,
                  color: THEME.colors.primary.dark,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = THEME.colors.gold.dark;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = THEME.colors.gold.primary;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Get Quote
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'block',
                background: 'transparent',
                border: 'none',
                color: THEME.colors.text.primary,
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px'
              }}
              className="mobile-menu-btn"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div style={{
              backgroundColor: THEME.colors.primary.dark,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <a href="#home" onClick={() => setMobileMenuOpen(false)} style={{ 
                  color: THEME.colors.text.secondary, 
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: 500,
                  padding: '12px 0'
                }}>Home</a>
                <a href="#services" onClick={() => setMobileMenuOpen(false)} style={{ 
                  color: THEME.colors.text.secondary, 
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: 500,
                  padding: '12px 0'
                }}>Services</a>
                <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ 
                  color: THEME.colors.text.secondary, 
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: 500,
                  padding: '12px 0'
                }}>Contact</a>
                <button
                  onClick={() => {
                    setQuoteModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    backgroundColor: THEME.colors.gold.primary,
                    color: THEME.colors.primary.dark,
                    border: 'none',
                    borderRadius: '6px',
                    padding: '14px 24px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginTop: '8px'
                  }}
                >
                  Get Quote
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* HERO SECTION */}
        <section id="home" style={{
          minHeight: '700px',
          display: 'flex',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${THEME.colors.primary.dark} 0%, ${THEME.colors.primary.navy} 100%)`,
          position: 'relative',
          overflow: 'hidden',
          marginTop: '70px'
        }}>
          {/* Background Image */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15,
            zIndex: 0
          }} />

          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '64px 24px',
            position: 'relative',
            zIndex: 1,
            width: '100%'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '48px',
              alignItems: 'center'
            }} className="hero-grid">
              {/* Left Content */}
              <div>
                <h1 style={{
                  fontSize: 'clamp(2rem, 5vw, 3rem)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                  marginBottom: '16px',
                  letterSpacing: '1px'
                }}>
                  DRIVING <span style={{ color: THEME.colors.gold.primary }}>EXCELLENCE</span><br />
                  IN LOGISTICS
                </h1>
                
                <p style={{
                  fontSize: '18px',
                  color: THEME.colors.text.secondary,
                  marginBottom: '32px',
                  fontWeight: 400
                }}>
                  Fast · Secure · Reliable UK & EU Transport
                </p>

                {/* CTA Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => setQuoteModalOpen(true)}
                    style={{
                      backgroundColor: THEME.colors.gold.primary,
                      color: THEME.colors.primary.dark,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '16px 32px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 16px rgba(212, 175, 55, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = THEME.colors.gold.dark;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = THEME.colors.gold.primary;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    Request a Quote
                  </button>

                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      backgroundColor: THEME.colors.green.whatsapp,
                      color: THEME.colors.text.primary,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '16px 32px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 16px rgba(37, 211, 102, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = THEME.colors.green.whatsappHover;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = THEME.colors.green.whatsapp;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    💬 WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES SECTION */}
        <section id="services" style={{
          padding: '64px 24px',
          backgroundColor: THEME.colors.primary.dark
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: THEME.colors.gold.primary,
              marginBottom: '48px',
              textAlign: 'center'
            }}>
              OUR SERVICES
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '24px'
            }} className="services-grid">
              {SERVICES.map((service, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '32px 24px',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: THEME.colors.gold.primary,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '16px'
                  }}>
                    {service.icon}
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: THEME.colors.text.primary
                  }}>
                    {service.title}
                  </h3>
                  <p style={{
                    fontSize: '15px',
                    color: THEME.colors.text.secondary,
                    lineHeight: 1.6
                  }}>
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY DANNY COURIER SECTION */}
        <section style={{
          padding: '64px 24px',
          backgroundColor: THEME.colors.primary.navy
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: THEME.colors.gold.primary,
              marginBottom: '32px',
              textAlign: 'center'
            }}>
              WHY DANNY COURIER
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '16px',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              {WHY_DANNY_COURIER.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 0'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: THEME.colors.green.primary,
                    color: THEME.colors.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    ✓
                  </div>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: THEME.colors.text.primary
                  }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TRUSTED BY SECTION */}
        <section style={{
          padding: '64px 24px',
          backgroundColor: THEME.colors.background.light
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              color: THEME.colors.primary.navy,
              marginBottom: '48px',
              textAlign: 'center'
            }}>
              TRUSTED BY UK BUSINESSES
            </h2>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '40px',
              flexWrap: 'wrap'
            }}>
              {TRUSTED_PARTNERS.map((partner, index) => (
                <div
                  key={index}
                  style={{
                    fontSize: '20px',
                    color: THEME.colors.text.dark,
                    opacity: 0.55,
                    ...partner.style
                  }}
                >
                  {partner.name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section style={{
          padding: '64px 24px',
          backgroundColor: THEME.colors.primary.navy,
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              marginBottom: '16px',
              color: THEME.colors.text.primary
            }}>
              Ready to Move Your Freight?
            </h2>
            <p style={{
              fontSize: '18px',
              color: THEME.colors.text.secondary,
              marginBottom: '32px'
            }}>
              Fast quote in under 10 minutes
            </p>
            <button
              onClick={() => setQuoteModalOpen(true)}
              style={{
                backgroundColor: THEME.colors.gold.primary,
                color: THEME.colors.primary.dark,
                border: 'none',
                borderRadius: '6px',
                padding: '18px 48px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.4)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = THEME.colors.gold.dark;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(212, 175, 55, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = THEME.colors.gold.primary;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(212, 175, 55, 0.4)';
              }}
            >
              Get Instant Quote
            </button>
          </div>
        </section>

        {/* CONTACT INFO BAR */}
        <section id="contact" style={{
          padding: '32px 24px',
          backgroundColor: THEME.colors.background.light
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '48px',
            flexWrap: 'wrap'
          }}>
            <a href={`tel:${COMPANY_CONFIG.phone}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: THEME.colors.primary.navy,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'color 0.3s ease'
            }}>
              <span style={{ fontSize: '20px' }}>📞</span>
              {COMPANY_CONFIG.phoneDisplay}
            </a>
            <a href={`mailto:${COMPANY_CONFIG.email}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: THEME.colors.primary.navy,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'color 0.3s ease'
            }}>
              <span style={{ fontSize: '20px' }}>✉️</span>
              {COMPANY_CONFIG.email}
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{
          backgroundColor: THEME.colors.primary.dark,
          padding: '48px 24px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            {/* Top Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px',
              flexWrap: 'wrap',
              gap: '24px'
            }}>
              {/* Logo */}
              <div style={{ 
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}>
                <span style={{ color: THEME.colors.gold.primary }}>X</span>
                <span style={{ color: THEME.colors.text.primary }}>Drive</span>
              </div>

              {/* Navigation */}
              <div style={{
                display: 'flex',
                gap: '32px',
                flexWrap: 'wrap'
              }}>
                <a href="#home" style={{
                  color: THEME.colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'color 0.3s ease'
                }}>Home</a>
                <a href="#services" style={{
                  color: THEME.colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'color 0.3s ease'
                }}>Services</a>
                <a href="#contact" style={{
                  color: THEME.colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'color 0.3s ease'
                }}>Contact</a>
              </div>
            </div>

            {/* Social Media Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '32px',
              paddingBottom: '32px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <a
                href={COMPANY_CONFIG.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: THEME.colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: '24px',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = THEME.colors.gold.primary;
                  e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = THEME.colors.text.secondary;
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                📘
              </a>
              <a
                href={COMPANY_CONFIG.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: THEME.colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: '24px',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = THEME.colors.gold.primary;
                  e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = THEME.colors.text.secondary;
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                📷
              </a>
              <a
                href={COMPANY_CONFIG.social.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: THEME.colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: '24px',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = THEME.colors.gold.primary;
                  e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = THEME.colors.text.secondary;
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🎵
              </a>
            </div>

            {/* Bottom Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '24px',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '14px',
              color: THEME.colors.text.secondary
            }}>
              <div>
                © 2026 Danny Courier Ltd
              </div>
              <a href="/privacy" style={{
                color: THEME.colors.text.secondary,
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}>
                Privacy Policy
              </a>
            </div>
          </div>
        </footer>

        {/* FLOATING WHATSAPP BUTTON */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            backgroundColor: THEME.colors.green.whatsapp,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 4px 24px rgba(37, 211, 102, 0.4)',
            transition: 'all 0.3s ease',
            zIndex: 999,
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 32px rgba(37, 211, 102, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(37, 211, 102, 0.4)';
          }}
        >
          💬
        </a>

        {/* QUOTE MODAL */}
        {quoteModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '24px'
            }}
            onClick={() => setQuoteModalOpen(false)}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${THEME.colors.primary.dark} 0%, ${THEME.colors.primary.navy} 100%)`,
                maxWidth: '600px',
                width: '100%',
                borderRadius: '12px',
                padding: '40px',
                position: 'relative',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setQuoteModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: THEME.colors.text.primary,
                  fontSize: '24px',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ✕
              </button>

              <h2 style={{
                fontSize: '28px',
                fontWeight: 700,
                marginBottom: '24px',
                color: THEME.colors.text.primary
              }}>
                Get a <span style={{ color: THEME.colors.gold.primary }}>QUOTE</span>
              </h2>

              {quoteSuccess ? (
                <div style={{
                  padding: '24px',
                  backgroundColor: 'rgba(31, 122, 61, 0.2)',
                  border: '1px solid rgba(31, 122, 61, 0.4)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: THEME.colors.text.primary
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Quote request submitted successfully!
                  </div>
                  <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.8 }}>
                    We'll get back to you shortly.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleQuoteSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input
                      type="text"
                      name="name"
                      placeholder="Full Name"
                      required
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email Address"
                      required
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Phone Number"
                      required
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <input
                      type="text"
                      name="pickup"
                      placeholder="Pickup Location"
                      required
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <input
                      type="text"
                      name="delivery"
                      placeholder="Delivery Location"
                      required
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <input
                      type="text"
                      name="cargoType"
                      placeholder="Cargo Type"
                      required
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <textarea
                      name="notes"
                      placeholder="Additional Notes"
                      rows={4}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        color: THEME.colors.text.primary,
                        fontSize: '15px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: THEME.typography.fonts.body,
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = THEME.colors.gold.primary;
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(212, 175, 55, 0.2)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        backgroundColor: THEME.colors.gold.primary,
                        color: THEME.colors.primary.dark,
                        border: 'none',
                        borderRadius: '6px',
                        padding: '16px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginTop: '8px',
                        height: '56px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 16px rgba(212, 175, 55, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = THEME.colors.gold.dark;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = THEME.colors.gold.primary;
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      Submit Quote Request
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Responsive Styles */}
      <style jsx>{`
        @media (min-width: 1024px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
          .hero-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .services-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .services-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </>
  );
}
