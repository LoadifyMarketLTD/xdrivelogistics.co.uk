'use client';

import { useState, useEffect } from 'react';
import { COMPANY_CONFIG } from '../../../config/company';
import { LoginModal } from '../../../components/LoginModal';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Drivers', href: '#for-drivers' },
  { label: 'For Companies', href: '#for-companies' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: scrolled
            ? 'rgba(10, 34, 57, 0.97)'
            : 'rgba(10, 34, 57, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: scrolled
            ? '1px solid rgba(212, 175, 55, 0.3)'
            : '1px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '4rem',
          }}
        >
          {/* Logo */}
          <a
            href="#home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--color-gold-primary)',
                letterSpacing: '-0.5px',
              }}
            >
              X
            </span>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--color-text-white)',
              }}
            >
              Drive Logistics
            </span>
          </a>

          {/* Desktop Nav Links */}
          <nav
            aria-label="Main navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            className="desktop-nav"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-gold-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Phone + Login */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexShrink: 0,
            }}
          >
            <a
              href={`tel:${COMPANY_CONFIG.phone}`}
              aria-label="Call us"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--color-gold-primary)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
              className="phone-link"
            >
              <span>📞</span>
              <span>{COMPANY_CONFIG.phoneDisplay}</span>
            </a>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1.5px solid var(--color-gold-primary)',
                backgroundColor: 'transparent',
                color: 'var(--color-gold-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-gold-primary)';
                e.currentTarget.style.color = 'var(--color-primary-navy-dark)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-gold-primary)';
              }}
            >
              Login
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-white)',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '1.5rem',
              }}
              className="mobile-menu-btn"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            style={{
              backgroundColor: 'rgba(10, 34, 57, 0.98)',
              borderTop: '1px solid rgba(212, 175, 55, 0.2)',
              padding: '1rem 24px 1.5rem',
            }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.75rem 0',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {link.label}
              </a>
            ))}
            <a
              href={`tel:${COMPANY_CONFIG.phone}`}
              style={{
                display: 'block',
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--color-primary-navy-dark)',
                backgroundColor: 'var(--color-gold-primary)',
                textDecoration: 'none',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              📞 Call {COMPANY_CONFIG.phoneDisplay}
            </a>
          </nav>
        )}
      </header>

      {/* Responsive styles */}
      <style jsx>{`
        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .phone-link {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
