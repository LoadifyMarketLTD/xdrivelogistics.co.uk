'use client';

import { COMPANY_CONFIG } from '../../../config/company';
import { useCompanyContactLinks } from '../../../hooks/useCompanyContactLinks';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { phoneHref, whatsappHref } = useCompanyContactLinks();

  return (
    <footer style={{ backgroundColor: '#0A2239', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>XDrive Logistics</p>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
              Exchange and operations platform by {COMPANY_CONFIG.legalName}.
            </p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)' }}>
              Company No. {COMPANY_CONFIG.companyNumber}
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Platform</p>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.78)' }}>Exchange workflow</p>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.78)' }}>Operations workflow</p>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.78)' }}>Owner operator workflow</p>
          </div>

          <div>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Contact</p>
            <a href={phoneHref} style={{ display: 'block', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', marginBottom: '0.35rem' }}>
              {COMPANY_CONFIG.phoneDisplay}
            </a>
            <a href={`mailto:${COMPANY_CONFIG.email}`} style={{ display: 'block', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', marginBottom: '0.35rem' }}>
              {COMPANY_CONFIG.email}
            </a>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
              WhatsApp
            </a>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', display: 'grid', gap: '0.3rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
            © {currentYear} {COMPANY_CONFIG.name}. All rights reserved.
          </p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>
            {COMPANY_CONFIG.legalName} is an independent platform and is not affiliated with Courier Exchange or any third-party courier exchange platform.
          </p>
        </div>
      </div>
    </footer>
  );
}
