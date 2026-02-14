'use client';

import { useState } from 'react';
import Image from 'next/image';
import { COMPANY_CONFIG } from './config/company';

const WHATSAPP_URL = `https://wa.me/${COMPANY_CONFIG.whatsapp.number}?text=${encodeURIComponent(COMPANY_CONFIG.whatsapp.defaultMessage)}`;

const SOCIAL_MEDIA_LINKS = [
  { name: 'Facebook', icon: '📘', url: COMPANY_CONFIG.social.facebook },
  { name: 'Instagram', icon: '📷', url: COMPANY_CONFIG.social.instagram },
  { name: 'TikTok', icon: '🎵', url: COMPANY_CONFIG.social.tiktok }
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState('EN');
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  const handleQuoteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    console.log('Quote Form Submitted:', Object.fromEntries(formData));
    setQuoteSuccess(true);
    e.currentTarget.reset();
    setTimeout(() => setQuoteSuccess(false), 5000);
  };

  return (
    <main style={{ backgroundColor: '#F4F7FA', minHeight: '100vh' }}>
      {/* 1. HEADER (STICKY) - PREMIUM CLEAN */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid rgba(30, 78, 140, 0.1)',
        height: '56px',
        boxShadow: '0 2px 8px rgba(10, 34, 57, 0.08)'
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
            color: '#0A2239'
          }}>
            {COMPANY_CONFIG.name}
          </div>

          {/* Desktop Navigation */}
          <div style={{ 
            display: 'none',
            gap: '32px',
            alignItems: 'center'
          }} className="desktop-nav">
            <a href="#home" style={{ fontWeight: '500', color: '#0A2239', transition: 'color 0.2s' }} className="nav-link">Home</a>
            <a href="#services" style={{ fontWeight: '500', color: '#0A2239', transition: 'color 0.2s' }} className="nav-link">Services</a>
            <a href="#about" style={{ fontWeight: '500', color: '#0A2239', transition: 'color 0.2s' }} className="nav-link">About</a>
            <a href="#contact" style={{ fontWeight: '500', color: '#0A2239', transition: 'color 0.2s' }} className="nav-link">Contact</a>
          </div>

          {/* Right Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Language Switcher */}
            <div style={{ display: 'flex', gap: '6px', fontSize: '14px' }}>
              {['EN', 'DE', 'FR', 'ES'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    background: language === lang ? '#1E4E8C' : 'transparent',
                    color: language === lang ? '#ffffff' : '#0A2239',
                    border: '1px solid rgba(30, 78, 140, 0.2)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
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
              backgroundColor: '#1F7A3D',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(31, 122, 61, 0.3)'
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
              <span style={{ width: '24px', height: '2px', backgroundColor: '#0A2239' }}></span>
              <span style={{ width: '24px', height: '2px', backgroundColor: '#0A2239' }}></span>
              <span style={{ width: '24px', height: '2px', backgroundColor: '#0A2239' }}></span>
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
            backgroundColor: '#ffffff',
            borderBottom: '1px solid rgba(30, 78, 140, 0.1)',
            padding: '16px',
            boxShadow: '0 8px 16px rgba(10, 34, 57, 0.1)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="#home" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#0A2239' }}>Home</a>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#0A2239' }}>Services</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#0A2239' }}>About</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ padding: '8px', fontWeight: '500', color: '#0A2239' }}>Contact</a>
              <a href="#quote" onClick={() => setMobileMenuOpen(false)} style={{ 
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#1F7A3D',
                color: '#ffffff',
                fontWeight: '600',
                borderRadius: '6px',
                textAlign: 'center',
                textDecoration: 'none'
              }}>Get a Quote</a>
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO SECTION - PREMIUM CLEAN */}
      <section id="home" style={{
        minHeight: '480px',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(10, 34, 57, 0.85) 0%, rgba(30, 78, 140, 0.85) 100%), url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&q=80) center/cover',
        color: 'white',
        position: 'relative',
        padding: '60px 0'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ 
              color: '#ffffff', 
              marginBottom: '12px', 
              lineHeight: '1.15',
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              fontWeight: '700'
            }}>
              Reliable Same Day & Express Transport
            </h1>
            
            <p style={{ 
              fontSize: 'clamp(1.75rem, 4vw, 2.8rem)', 
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '20px'
            }}>
              Across the UK & Europe
            </p>
            
            <p style={{ 
              fontSize: 'clamp(16px, 2vw, 19px)', 
              marginBottom: '36px',
              color: 'rgba(255, 255, 255, 0.95)',
              lineHeight: '1.6',
              maxWidth: '650px',
              margin: '0 auto 36px'
            }}>
              Fast, Secure & On-Time Deliveries 24/7
            </p>
            
            {/* CTAs */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '16px', 
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <a href="#quote" style={{ 
                height: '52px', 
                fontSize: '16px',
                padding: '0 32px',
                backgroundColor: '#1F7A3D',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(31, 122, 61, 0.4)',
                transition: 'all 0.3s'
              }} className="green-btn">
                📦 Get a Free Quote
              </a>
              <a href="tel:+447423272138" style={{ 
                height: '52px',
                fontSize: '16px',
                padding: '0 32px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255, 255, 255, 0.4)',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                transition: 'all 0.3s'
              }} className="outline-btn">
                📞 Call Us: {COMPANY_CONFIG.phoneDisplay}
              </a>
            </div>
          </div>
        </div>
      </section>

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
          color: #1E4E8C !important;
        }
        #nav-cta:hover {
          background-color: #1a6534 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(31, 122, 61, 0.4) !important;
        }
        .green-btn:hover {
          background-color: #1a6534 !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(31, 122, 61, 0.5) !important;
        }
        .outline-btn:hover {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.6) !important;
          transform: translateY(-2px);
        }
      `}</style>

      {/* 3. BENEFITS STRIP */}
      <section style={{ 
        backgroundColor: '#ffffff',
        padding: '48px 0',
        borderBottom: '1px solid rgba(30, 78, 140, 0.1)'
      }}>
        <div className="container">
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '24px',
              backgroundColor: '#F4F7FA',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 8px rgba(10, 34, 57, 0.05)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🕐</div>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '8px'
              }}>24/7 Service</h2>
              <p style={{ fontSize: '14px', color: '#1E4E8C' }}>Always available for your urgent deliveries</p>
            </div>
            
            <div style={{
              textAlign: 'center',
              padding: '24px',
              backgroundColor: '#F4F7FA',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 8px rgba(10, 34, 57, 0.05)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌍</div>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '8px'
              }}>UK & Europe</h2>
              <p style={{ fontSize: '14px', color: '#1E4E8C' }}>Comprehensive coverage across the continent</p>
            </div>
            
            <div style={{
              textAlign: 'center',
              padding: '24px',
              backgroundColor: '#F4F7FA',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 8px rgba(10, 34, 57, 0.05)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '8px'
              }}>Fully Insured</h2>
              <p style={{ fontSize: '14px', color: '#1E4E8C' }}>Your cargo is protected every step</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. QUICK QUOTE SECTION (MOST IMPORTANT) */}
      <section id="quote" style={{ 
        backgroundColor: '#F4F7FA',
        padding: '64px 0'
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', 
              fontWeight: '700',
              color: '#0A2239',
              marginBottom: '12px'
            }}>Get Your Free Quote</h2>
            <p style={{ fontSize: '17px', color: '#1E4E8C' }}>
              Fill out the form below and we'll get back to you within 1 hour
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '40px',
            maxWidth: '1200px',
            margin: '0 auto',
            alignItems: 'center'
          }} className="quote-grid">
            {/* Form */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '40px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(10, 34, 57, 0.1)',
              border: '1px solid rgba(30, 78, 140, 0.1)'
            }}>
              <form onSubmit={handleQuoteSubmit}>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '20px'
                }} className="form-grid">
                  <div>
                    <label htmlFor="quote-name" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Full Name *</label>
                    <input
                      id="quote-name"
                      type="text"
                      name="name"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="quote-email" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Email *</label>
                    <input
                      id="quote-email"
                      type="email"
                      name="email"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="quote-pickup" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Pickup Location *</label>
                    <input
                      id="quote-pickup"
                      type="text"
                      name="pickup"
                      required
                      placeholder="e.g., London, UK"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="quote-delivery" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Delivery Location *</label>
                    <input
                      id="quote-delivery"
                      type="text"
                      name="delivery"
                      required
                      placeholder="e.g., Paris, France"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="quote-cargo-type" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Cargo Type *</label>
                    <select
                      id="quote-cargo-type"
                      name="cargoType"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    >
                      <option value="">Select cargo type</option>
                      <option value="pallets">Pallets</option>
                      <option value="parcels">Parcels</option>
                      <option value="furniture">Furniture</option>
                      <option value="documents">Documents</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quote-quantity" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Quantity (optional)</label>
                    <input
                      id="quote-quantity"
                      type="text"
                      name="quantity"
                      placeholder="e.g., 5 pallets"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="quote-notes" style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#0A2239'
                    }}>Notes (optional)</label>
                    <textarea
                      id="quote-notes"
                      name="notes"
                      rows={4}
                      placeholder="Any special requirements or additional information..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid rgba(30, 78, 140, 0.2)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        transition: 'border-color 0.2s'
                      }}
                      className="form-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: '#1F7A3D',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: '0 4px 12px rgba(31, 122, 61, 0.3)'
                  }}
                  className="submit-btn"
                >
                  Request a Quote
                </button>

                {quoteSuccess && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#d4edda',
                    border: '1px solid #c3e6cb',
                    borderRadius: '6px',
                    color: '#155724',
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    ✅ Request sent! We'll contact you soon.
                  </div>
                )}
              </form>
            </div>

            {/* Promo Image - Desktop Only */}
            <div style={{
              display: 'none',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(10, 34, 57, 0.1)',
              position: 'relative',
              height: '400px'
            }} className="promo-image">
              <Image 
                src="https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=600&q=80" 
                alt="Transport services"
                fill
                style={{
                  objectFit: 'cover'
                }}
                sizes="(max-width: 768px) 100vw, 600px"
              />
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (min-width: 1024px) {
          .quote-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .form-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .promo-image {
            display: block !important;
          }
        }
        .form-input:focus {
          border-color: #1E4E8C !important;
        }
        .submit-btn:hover {
          background-color: #1a6534 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(31, 122, 61, 0.4) !important;
        }
      `}</style>

      {/* 5. CONTACT QUICK ACTIONS */}
      <section style={{ 
        backgroundColor: '#ffffff',
        padding: '48px 0',
        borderTop: '1px solid rgba(30, 78, 140, 0.1)'
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '600',
              color: '#0A2239',
              marginBottom: '8px'
            }}>Get In Touch</h3>
            <p style={{ fontSize: '15px', color: '#1E4E8C' }}>
              Choose your preferred contact method
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            justifyContent: 'center',
            marginBottom: '32px'
          }}>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              backgroundColor: '#128C7E',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '15px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 8px rgba(18, 140, 126, 0.3)'
            }} className="contact-btn whatsapp-btn">
              <span style={{ fontSize: '20px' }}>💬</span>
              WhatsApp Us
            </a>

            <a href={`mailto:${COMPANY_CONFIG.email}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              backgroundColor: '#1E4E8C',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '15px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 8px rgba(30, 78, 140, 0.3)'
            }} className="contact-btn email-btn">
              <span style={{ fontSize: '20px' }}>📧</span>
              Email Us
            </a>

            <a href={`tel:${COMPANY_CONFIG.phone}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              backgroundColor: '#1F7A3D',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '15px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 8px rgba(31, 122, 61, 0.3)'
            }} className="contact-btn call-btn">
              <span style={{ fontSize: '20px' }}>📞</span>
              Call Us
            </a>
          </div>

          {/* Social Icons */}
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            paddingTop: '24px',
            borderTop: '1px solid rgba(30, 78, 140, 0.1)'
          }}>
            {SOCIAL_MEDIA_LINKS.map((social, idx) => (
              <a 
                key={idx}
                href={social.url}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '2px solid #1E4E8C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  transition: 'all 0.3s',
                  backgroundColor: '#F4F7FA',
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
        .contact-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        }
        .whatsapp-btn:hover {
          background-color: #0d6b5f !important;
        }
        .email-btn:hover {
          background-color: #1a3f70 !important;
        }
        .call-btn:hover {
          background-color: #1a6534 !important;
        }
        .social-icon:hover {
          transform: scale(1.1);
          border-color: #0A2239 !important;
          background-color: #ffffff !important;
        }
      `}</style>

      {/* 6. SERVICES - COMPACT */}
      <section id="services" style={{ 
        backgroundColor: '#F4F7FA',
        padding: '64px 0'
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', 
              fontWeight: '700',
              color: '#0A2239',
              marginBottom: '12px'
            }}>Our Services</h2>
            <p style={{ fontSize: '17px', color: '#1E4E8C' }}>
              Comprehensive transport solutions for all your needs
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 12px rgba(10, 34, 57, 0.06)',
              transition: 'all 0.3s'
            }} className="service-card">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '12px'
              }}>Same Day Delivery</h3>
              <p style={{ fontSize: '15px', color: '#1E4E8C', lineHeight: '1.6' }}>
                Urgent shipments delivered the same day across the UK
              </p>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 12px rgba(10, 34, 57, 0.06)',
              transition: 'all 0.3s'
            }} className="service-card">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '12px'
              }}>Express / Next Day</h3>
              <p style={{ fontSize: '15px', color: '#1E4E8C', lineHeight: '1.6' }}>
                Fast next-day delivery to any UK or European destination
              </p>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 12px rgba(10, 34, 57, 0.06)',
              transition: 'all 0.3s'
            }} className="service-card">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '12px'
              }}>Scheduled Transport</h3>
              <p style={{ fontSize: '15px', color: '#1E4E8C', lineHeight: '1.6' }}>
                Plan ahead with our flexible scheduled delivery options
              </p>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 12px rgba(10, 34, 57, 0.06)',
              transition: 'all 0.3s'
            }} className="service-card">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '12px'
              }}>Pallet Transport</h3>
              <p style={{ fontSize: '15px', color: '#1E4E8C', lineHeight: '1.6' }}>
                Secure pallet delivery with professional handling
              </p>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 12px rgba(10, 34, 57, 0.06)',
              transition: 'all 0.3s'
            }} className="service-card">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌍</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '12px'
              }}>UK-EU Road Freight</h3>
              <p style={{ fontSize: '15px', color: '#1E4E8C', lineHeight: '1.6' }}>
                Reliable cross-border transport throughout Europe
              </p>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(30, 78, 140, 0.1)',
              boxShadow: '0 2px 12px rgba(10, 34, 57, 0.06)',
              transition: 'all 0.3s'
            }} className="service-card">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚚</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#0A2239',
                marginBottom: '12px'
              }}>Dedicated Van</h3>
              <p style={{ fontSize: '15px', color: '#1E4E8C', lineHeight: '1.6' }}>
                Exclusive vehicle for your specific delivery needs
              </p>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(10, 34, 57, 0.12) !important;
          border-color: rgba(30, 78, 140, 0.3) !important;
        }
      `}</style>

      {/* 7. ABOUT - COMPACT */}
      <section id="about" style={{ 
        backgroundColor: '#ffffff',
        padding: '64px 0',
        borderTop: '1px solid rgba(30, 78, 140, 0.1)'
      }}>
        <div className="container">
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ 
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', 
                fontWeight: '700',
                color: '#0A2239',
                marginBottom: '16px'
              }}>About {COMPANY_CONFIG.name}</h2>
              <p style={{ 
                fontSize: '16px', 
                color: '#1E4E8C', 
                lineHeight: '1.7',
                marginBottom: '32px'
              }}>
                Established in 2021, {COMPANY_CONFIG.name} is your trusted partner for professional transport and courier services across the UK and Europe. We pride ourselves on delivering excellence with every shipment, ensuring your cargo arrives safely and on time, every time.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px'
            }}>
              <div style={{
                padding: '24px',
                backgroundColor: '#F4F7FA',
                borderRadius: '10px',
                border: '1px solid rgba(30, 78, 140, 0.1)'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏆</div>
                <h4 style={{ 
                  fontSize: '17px', 
                  fontWeight: '600', 
                  color: '#0A2239',
                  marginBottom: '8px'
                }}>Established 2021</h4>
                <p style={{ fontSize: '14px', color: '#1E4E8C' }}>
                  Years of reliable service and growing expertise
                </p>
              </div>

              <div style={{
                padding: '24px',
                backgroundColor: '#F4F7FA',
                borderRadius: '10px',
                border: '1px solid rgba(30, 78, 140, 0.1)'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                <h4 style={{ 
                  fontSize: '17px', 
                  fontWeight: '600', 
                  color: '#0A2239',
                  marginBottom: '8px'
                }}>Reliable & Professional</h4>
                <p style={{ fontSize: '14px', color: '#1E4E8C' }}>
                  Committed to on-time deliveries with professional care
                </p>
              </div>

              <div style={{
                padding: '24px',
                backgroundColor: '#F4F7FA',
                borderRadius: '10px',
                border: '1px solid rgba(30, 78, 140, 0.1)'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛡️</div>
                <h4 style={{ 
                  fontSize: '17px', 
                  fontWeight: '600', 
                  color: '#0A2239',
                  marginBottom: '8px'
                }}>Fully Insured</h4>
                <p style={{ fontSize: '14px', color: '#1E4E8C' }}>
                  Complete peace of mind with comprehensive insurance
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER - CORPORATE LIGHT */}
      <footer id="contact" style={{ 
        backgroundColor: '#0A2239',
        color: '#ffffff',
        padding: '48px 0 24px'
      }}>
        <div className="container">
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '32px',
            marginBottom: '32px'
          }} className="footer-grid">
            <div>
              <h3 style={{ 
                fontSize: '22px', 
                fontWeight: '700',
                marginBottom: '16px',
                color: '#ffffff'
              }}>{COMPANY_CONFIG.name}</h3>
              <p style={{ 
                fontSize: '15px', 
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.6',
                marginBottom: '20px'
              }}>
                Professional transport and logistics services across the UK and Europe. Available 24/7 for all your delivery needs.
              </p>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>📧</span>
                  <a href={`mailto:${COMPANY_CONFIG.email}`} style={{ 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    textDecoration: 'none',
                    fontSize: '15px'
                  }}>{COMPANY_CONFIG.email}</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>📞</span>
                  <a href={`tel:${COMPANY_CONFIG.phone}`} style={{ 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    textDecoration: 'none',
                    fontSize: '15px'
                  }}>{COMPANY_CONFIG.phoneDisplay}</a>
                </div>
              </div>

              {/* Social Icons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px'
              }}>
                {SOCIAL_MEDIA_LINKS.map((social, idx) => (
                  <a 
                    key={idx}
                    href={social.url}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      transition: 'all 0.3s',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      textDecoration: 'none'
                    }}
                    className="footer-social"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>

              {/* WhatsApp CTA */}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 24px',
                backgroundColor: '#128C7E',
                color: '#ffffff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '15px',
                transition: 'all 0.3s',
                boxShadow: '0 2px 8px rgba(18, 140, 126, 0.3)'
              }} className="footer-whatsapp">
                <span style={{ fontSize: '20px' }}>💬</span>
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{
            paddingTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '12px',
              fontWeight: '500'
            }}>
              24/7 • UK & Europe • Fully Insured
            </p>
            <p style={{ 
              fontSize: '13px', 
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              © {new Date().getFullYear()} {COMPANY_CONFIG.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .footer-social:hover {
          transform: scale(1.1);
          border-color: rgba(255, 255, 255, 0.6) !important;
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
        .footer-whatsapp:hover {
          background-color: #0d6b5f !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4) !important;
        }
      `}</style>

      {/* 9. FLOATING WHATSAPP BUTTON */}
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
          backgroundColor: '#25D366',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          boxShadow: '0 4px 16px rgba(37, 211, 102, 0.4)',
          zIndex: 999,
          transition: 'all 0.3s',
          textDecoration: 'none'
        }}
        className="floating-whatsapp"
        aria-label="Chat on WhatsApp"
      >
        💬
      </a>

      <style jsx>{`
        .floating-whatsapp:hover {
          transform: scale(1.15);
          box-shadow: 0 6px 24px rgba(37, 211, 102, 0.6) !important;
        }
      `}</style>
    </main>
  );
}
