'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoginModal } from '../../../components/LoginModal';

const NAV_LINKS = [
  { label: 'Roles', href: '#roles' },
  { label: 'Exchange', href: '#exchange' },
  { label: 'Flow', href: '#how-it-works' },
  { label: 'Operations', href: '#operations' },
  { label: 'Owner Operator', href: '#owner-operator' },
  { label: 'Trust', href: '#trust' },
  { label: 'FAQ', href: '#faq' },
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

  const isLight = scrolled;

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.97)' : 'rgba(10, 34, 57, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: scrolled ? '1px solid rgba(31,58,95,0.08)' : '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '4rem',
            gap: '0.75rem',
          }}
        >
          <a
            href="#home"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', flexShrink: 0 }}
          >
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#D4AF37' }}>X</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isLight ? '#1F3A5F' : '#FFFFFF' }}>Drive</span>
          </a>

          <nav aria-label="Main navigation" className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isLight ? '#374151' : 'rgba(255,255,255,0.9)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <Link
              href="/request-quote"
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
                backgroundColor: '#2E7D32',
                color: '#FFFFFF',
                textDecoration: 'none',
              }}
            >
              Request / Post
            </Link>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: `1.5px solid ${isLight ? '#1F3A5F' : '#D4AF37'}`,
                backgroundColor: 'transparent',
                color: isLight ? '#1F3A5F' : '#D4AF37',
                cursor: 'pointer',
              }}
            >
              Login
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="mobile-menu-btn"
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: isLight ? '#1F3A5F' : '#FFFFFF',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '1.35rem',
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid rgba(31,58,95,0.1)', padding: '0.75rem 16px 1rem' }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.7rem 0',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#374151',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(31,58,95,0.06)',
                }}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block',
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#FFFFFF',
                backgroundColor: '#1F3A5F',
                textDecoration: 'none',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              Join as Carrier / Owner Operator
            </Link>
            <button
              onClick={() => {
                setMenuOpen(false);
                setIsLoginModalOpen(true);
              }}
              style={{
                width: '100%',
                marginTop: '0.6rem',
                padding: '0.75rem 1rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#1F3A5F',
                backgroundColor: 'transparent',
                border: '1px solid #1F3A5F',
                borderRadius: '8px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              Login
            </button>
          </nav>
        )}
      </header>

      <style jsx>{`
        @media (max-width: 980px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </>
  );
}
