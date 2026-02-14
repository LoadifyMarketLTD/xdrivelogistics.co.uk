'use client';

import { useState } from 'react';
import Image from 'next/image';
import { COMPANY_CONFIG } from './config/company';
import { THEME, glassStyle, goldButton, darkGlassButton } from './config/theme';

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

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState('EN');
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
      color: THEME.colors.text.primary 
    }}>
      {/* HEADER - Dark with Glass Effect */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        ...glassStyle('dark'),
        height: '72px',
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
            fontSize: '24px', 
            fontWeight: THEME.typography.weights.bold,
            color: THEME.colors.text.primary,
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <span style={{ color: THEME.colors.gold.primary }}>XDrive</span> Logistics
          </div>

          {/* Desktop Navigation */}
          <div style={{ 
            display: 'none',
            gap: '48px',
            alignItems: 'center'
          }} className="desktop-nav">
            <a href="#home" style={{ 
              fontWeight: THEME.typography.weights.medium, 
              color: THEME.colors.text.secondary, 
              transition: THEME.transitions.fast,
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontSize: '14px',
              letterSpacing: '0.5px'
            }} className="nav-link">Home</a>
            <a href="#services" style={{ 
              fontWeight: THEME.typography.weights.medium, 
              color: THEME.colors.text.secondary, 
              transition: THEME.transitions.fast,
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontSize: '14px',
              letterSpacing: '0.5px'
            }} className="nav-link">Services</a>
            <a href="#contact" style={{ 
              fontWeight: THEME.typography.weights.medium, 
              color: THEME.colors.text.secondary, 
              transition: THEME.transitions.fast,
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontSize: '14px',
              letterSpacing: '0.5px'
            }} className="nav-link">Contact</a>
          </div>

          {/* Right Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Language Switcher */}
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              fontSize: '12px',
              ...glassStyle('light'),
              padding: '6px',
              borderRadius: THEME.borderRadius.md
            }}>
              {['EN', 'DE', 'FR', 'ES'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    background: language === lang ? THEME.colors.gold.primary : 'transparent',
                    color: language === lang ? THEME.colors.primary.dark : THEME.colors.text.secondary,
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: THEME.borderRadius.sm,
                    cursor: 'pointer',
                    fontWeight: THEME.typography.weights.semibold,
                    fontSize: '12px',
                    transition: THEME.transitions.fast,
                    textTransform: 'uppercase'
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                ...glassStyle('light'),
                border: 'none',
                padding: '12px',
                borderRadius: THEME.borderRadius.md,
                cursor: 'pointer',
                fontSize: '24px',
                lineHeight: 1
              }}
              className="mobile-menu-btn"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div style={{
            ...glassStyle('dark'),
            position: 'absolute',
            top: '72px',
            left: 0,
            right: 0,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <a href="#home" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: THEME.typography.weights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Home</a>
            <a href="#services" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: THEME.typography.weights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Services</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ 
              color: THEME.colors.text.primary, 
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: THEME.typography.weights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Contact</a>
          </div>
        )}
      </nav>

      {/* HERO SECTION - Cinematic Premium */}
      <section id="home" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: `linear-gradient(135deg, rgba(10, 14, 26, 0.95) 0%, rgba(26, 31, 46, 0.85) 100%), url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&q=80) center/cover`,
        position: 'relative',
        padding: '120px 24px 80px',
      }}>
        <div className="container" style={{ 
          position: 'relative', 
          zIndex: 1,
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ 
              color: THEME.colors.text.primary,
              marginBottom: '24px', 
              lineHeight: '1.1',
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: THEME.typography.weights.bold,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              textShadow: `0 4px 20px ${THEME.colors.primary.dark}`
            }}>
              DRIVING EXCELLENCE
              <br />
              <span style={{ color: THEME.colors.gold.primary }}>IN LOGISTICS</span>
            </h1>
            
            <p style={{ 
              fontSize: 'clamp(18px, 3vw, 28px)', 
              fontWeight: THEME.typography.weights.medium,
              color: THEME.colors.text.secondary,
              marginBottom: '48px',
              letterSpacing: '3px',
              textTransform: 'uppercase'
            }}>
              Fast <span style={{ color: THEME.colors.gold.primary }}>•</span> Secure <span style={{ color: THEME.colors.gold.primary }}>•</span> Reliable
              <br />
              UK & EU Transport
            </p>
            
            {/* Hero CTAs */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '20px', 
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <button 
                onClick={() => setQuoteModalOpen(true)}
                style={{ 
                  ...goldButton,
                  height: '60px',
                  minWidth: '220px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  border: 'none'
                }} 
                className="gold-btn"
              >
                <span style={{ fontSize: '24px' }}>📦</span>
                Request a Quote
              </button>
              
              <a 
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  ...darkGlassButton,
                  height: '60px',
                  minWidth: '220px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  textDecoration: 'none'
                }} 
                className="glass-btn"
              >
                <span style={{ fontSize: '24px' }}>💬</span>
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* MID SECTION - Services & Why XDrive */}
      <section id="services" style={{ 
        backgroundColor: THEME.colors.primary.navy,
        padding: '80px 24px',
        position: 'relative'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '60px'
          }} className="services-grid">
            {/* LEFT: OUR SERVICES */}
            <div>
              <h2 style={{ 
                fontSize: 'clamp(32px, 5vw, 48px)', 
                fontWeight: THEME.typography.weights.bold,
                color: THEME.colors.text.primary,
                marginBottom: '40px',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                <span style={{ color: THEME.colors.gold.primary }}>Our</span> Services
              </h2>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px'
              }}>
                {SERVICES.map((service, idx) => (
                  <div key={idx} style={{
                    ...glassStyle('light'),
                    padding: '32px',
                    borderRadius: THEME.borderRadius.lg,
                    transition: THEME.transitions.medium,
                    cursor: 'pointer'
                  }} className="service-card">
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>{service.icon}</div>
                    <h3 style={{ 
                      fontSize: '24px', 
                      fontWeight: THEME.typography.weights.bold, 
                      color: THEME.colors.text.primary,
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>{service.title}</h3>
                    <p style={{ 
                      fontSize: '16px', 
                      color: THEME.colors.text.muted,
                      lineHeight: '1.6'
                    }}>{service.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: WHY XDRIVE */}
            <div>
              <h2 style={{ 
                fontSize: 'clamp(32px, 5vw, 48px)', 
                fontWeight: THEME.typography.weights.bold,
                color: THEME.colors.text.primary,
                marginBottom: '40px',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                Why <span style={{ color: THEME.colors.gold.primary }}>XDrive</span>
              </h2>
              
              <div style={{ 
                ...glassStyle('light'),
                padding: '40px',
                borderRadius: THEME.borderRadius.lg
              }}>
                {WHY_XDRIVE.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px 0',
                    borderBottom: idx < WHY_XDRIVE.length - 1 ? `1px solid ${THEME.colors.border.light}` : 'none'
                  }}>
                    <div style={{ 
                      fontSize: '24px',
                      color: THEME.colors.gold.primary
                    }}>✓</div>
                    <span style={{ 
                      fontSize: '20px',
                      fontWeight: THEME.typography.weights.medium,
                      color: THEME.colors.text.primary,
                      letterSpacing: '0.5px'
                    }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF BAND */}
      <section style={{ 
        backgroundColor: THEME.colors.primary.dark,
        padding: '60px 24px',
        borderTop: `1px solid ${THEME.colors.border.light}`,
        borderBottom: `1px solid ${THEME.colors.border.light}`
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: 'clamp(20px, 3vw, 28px)', 
            fontWeight: THEME.typography.weights.bold,
            color: THEME.colors.text.secondary,
            marginBottom: '32px',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            Trusted by <span style={{ color: THEME.colors.gold.primary }}>UK Businesses</span>
          </h3>
          
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '48px',
            opacity: 0.6
          }}>
            <div style={{ 
              ...glassStyle('light'),
              padding: '24px 48px',
              borderRadius: THEME.borderRadius.md,
              fontSize: '18px',
              fontWeight: THEME.typography.weights.semibold,
              color: THEME.colors.text.secondary
            }}>Retail</div>
            <div style={{ 
              ...glassStyle('light'),
              padding: '24px 48px',
              borderRadius: THEME.borderRadius.md,
              fontSize: '18px',
              fontWeight: THEME.typography.weights.semibold,
              color: THEME.colors.text.secondary
            }}>Logistics</div>
            <div style={{ 
              ...glassStyle('light'),
              padding: '24px 48px',
              borderRadius: THEME.borderRadius.md,
              fontSize: '18px',
              fontWeight: THEME.typography.weights.semibold,
              color: THEME.colors.text.secondary
            }}>Construction</div>
            <div style={{ 
              ...glassStyle('light'),
              padding: '24px 48px',
              borderRadius: THEME.borderRadius.md,
              fontSize: '18px',
              fontWeight: THEME.typography.weights.semibold,
              color: THEME.colors.text.secondary
            }}>E-Commerce</div>
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ 
        backgroundColor: THEME.colors.primary.navy,
        padding: '120px 24px',
        textAlign: 'center'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <h2 style={{ 
            fontSize: 'clamp(32px, 5vw, 56px)', 
            fontWeight: THEME.typography.weights.bold,
            color: THEME.colors.text.primary,
            marginBottom: '32px',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            Ready to Move <span style={{ color: THEME.colors.gold.primary }}>Your Freight?</span>
          </h2>
          
          <button 
            onClick={() => setQuoteModalOpen(true)}
            style={{ 
              ...goldButton,
              height: '70px',
              minWidth: '280px',
              fontSize: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              border: 'none'
            }} 
            className="gold-btn"
          >
            Get Instant Quote
          </button>
        </div>
      </section>

      {/* CONTACT STRIP & FOOTER */}
      <footer id="contact" style={{ 
        backgroundColor: THEME.colors.primary.dark,
        padding: '60px 24px 40px'
      }}>
        <div className="container" style={{ 
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          {/* Contact Info */}
          <div style={{
            textAlign: 'center',
            marginBottom: '48px',
            padding: '40px',
            ...glassStyle('light'),
            borderRadius: THEME.borderRadius.lg
          }}>
            <h3 style={{ 
              fontSize: '32px', 
              fontWeight: THEME.typography.weights.bold,
              marginBottom: '32px',
              color: THEME.colors.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>Get In Touch</h3>
            
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '24px',
              marginBottom: '32px'
            }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ 
                ...darkGlassButton,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>💬</span>
                WhatsApp
              </a>
              
              <a href={`mailto:${COMPANY_CONFIG.email}`} style={{ 
                ...darkGlassButton,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>📧</span>
                Email Us
              </a>
              
              <a href={`tel:${COMPANY_CONFIG.phone}`} style={{ 
                ...darkGlassButton,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>📞</span>
                Call Us
              </a>
            </div>

            {/* Contact Details */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: THEME.colors.text.secondary,
              fontSize: '18px'
            }}>
              <div>
                <strong style={{ color: THEME.colors.gold.primary }}>Email:</strong> {COMPANY_CONFIG.email}
              </div>
              <div>
                <strong style={{ color: THEME.colors.gold.primary }}>Phone:</strong> {COMPANY_CONFIG.phoneDisplay}
              </div>
            </div>
          </div>

          {/* Social Icons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            marginBottom: '40px'
          }}>
            {SOCIAL_MEDIA_LINKS.map((social, idx) => (
              <a 
                key={idx}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...glassStyle('light'),
                  width: '56px',
                  height: '56px',
                  borderRadius: THEME.borderRadius.full,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  transition: THEME.transitions.medium,
                  textDecoration: 'none'
                }}
                className="social-icon"
                aria-label={social.name}
              >
                {social.icon}
              </a>
            ))}
          </div>

          {/* Footer Links */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '32px',
            marginBottom: '32px',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <a href="#home" style={{ color: THEME.colors.text.muted, textDecoration: 'none' }}>Home</a>
            <a href="#services" style={{ color: THEME.colors.text.muted, textDecoration: 'none' }}>Services</a>
            <a href="#contact" style={{ color: THEME.colors.text.muted, textDecoration: 'none' }}>Contact</a>
            <a href="/privacy" style={{ color: THEME.colors.text.muted, textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ color: THEME.colors.text.muted, textDecoration: 'none' }}>Terms</a>
          </div>

          {/* Copyright */}
          <div style={{
            textAlign: 'center',
            color: THEME.colors.text.muted,
            fontSize: '14px',
            paddingTop: '32px',
            borderTop: `1px solid ${THEME.colors.border.light}`
          }}>
            <p style={{ marginBottom: '8px' }}>
              24/7 <span style={{ color: THEME.colors.gold.primary }}>•</span> UK & Europe <span style={{ color: THEME.colors.gold.primary }}>•</span> Fully Insured
            </p>
            <p>© 2026 {COMPANY_CONFIG.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>

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
        
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
          .services-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 767px) {
          .mobile-sticky-bar {
            display: flex !important;
          }
        }
        
        .nav-link:hover {
          color: ${THEME.colors.gold.primary} !important;
        }
        
        .gold-btn:hover {
          transform: translateY(-2px);
          box-shadow: ${THEME.shadows.glow};
        }
        
        .glass-btn:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          transform: translateY(-2px);
        }
        
        .service-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.15) !important;
          box-shadow: ${THEME.shadows.lg};
        }
        
        .social-icon:hover {
          transform: scale(1.1);
          background: rgba(255, 255, 255, 0.2) !important;
        }
        
        .form-input:focus {
          border-color: ${THEME.colors.gold.primary} !important;
          box-shadow: 0 0 0 2px ${THEME.colors.gold.primary}40 !important;
        }
      `}</style>
    </main>
  );
}
