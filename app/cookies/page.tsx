import type { Metadata } from 'next';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'XDrive Logistics Cookie Policy — how we use cookies on our website and how you can manage your preferences.',
};

const LAST_UPDATED = '20 February 2026';

export default function CookiesPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-primary-navy-dark)',
        color: 'var(--color-text-white)',
        padding: '6rem 24px 4rem',
      }}
    >
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-gold-primary)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            marginBottom: '2rem',
          }}
        >
          ← Back to Home
        </a>

        <h1
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800,
            color: 'var(--color-text-white)',
            marginBottom: '0.5rem',
          }}
        >
          Cookie Policy
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.7', color: 'rgba(255,255,255,0.82)' }}>
          <Section title="1. What Are Cookies?">
            Cookies are small text files placed on your device when you visit a website. They help
            the website remember your preferences, understand how you use the site, and provide
            a better experience.
          </Section>

          <Section title="2. How We Use Cookies">
            {COMPANY_CONFIG.legalName} uses cookies for the following purposes:
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '1rem',
                fontSize: '0.9rem',
              }}
            >
              <thead>
                <tr>
                  {['Cookie Type', 'Purpose', 'Duration'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(212,175,55,0.15)',
                        color: 'var(--color-gold-primary)',
                        borderBottom: '1px solid rgba(212,175,55,0.3)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Strictly Necessary', 'Authentication, session management, security', 'Session'],
                  ['Functional', 'User preferences needed for core platform UX', 'Up to 1 year'],
                ].map(([type, purpose, duration], i) => (
                  <tr key={i}>
                    {[type, purpose, duration].map((cell, j) => (
                      <td
                        key={j}
                        style={{
                          padding: '0.75rem',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          verticalAlign: 'top',
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="3. Third-Party Cookies">
            We currently do not run non-essential analytics or advertising trackers on the public website.
            Third-party cookies may still be set when you intentionally use third-party links/services, including:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li><strong>Supabase</strong> — authentication and database services</li>
              <li><strong>WhatsApp</strong> — click-to-chat functionality</li>
            </ul>
            These third parties have their own privacy and cookie policies, which we encourage you to review.
          </Section>

          <Section title="4. Managing Cookies">
            You can control and manage cookies through your browser settings. Most browsers allow you to:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>View cookies stored on your device</li>
              <li>Delete specific or all cookies</li>
              <li>Block cookies from specific or all websites</li>
              <li>Set preferences for each website</li>
            </ul>
            Please note that disabling strictly necessary cookies may affect the functionality of our platform,
            including your ability to log in and use core features.
          </Section>

          <Section title="5. Consent">
            Because we currently use only essential cookies on the public website, a non-essential cookie
            consent banner is not shown. If non-essential cookies are introduced in future, this policy and
            consent handling will be updated before activation.
          </Section>

          <Section title="6. Changes to This Policy">
            We may update this Cookie Policy from time to time. Changes will be posted on this page
            with an updated &quot;Last updated&quot; date.
          </Section>

          <Section title="7. Contact Us">
            If you have any questions about our use of cookies, please contact:<br /><br />
            {COMPANY_CONFIG.legalName}<br />
            {COMPANY_CONFIG.address.street}, {COMPANY_CONFIG.address.city}, {COMPANY_CONFIG.address.postcode}<br />
            Email: {COMPANY_CONFIG.email}<br />
            Phone: {COMPANY_CONFIG.phoneDisplay}
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'var(--color-gold-primary)',
          marginBottom: '0.75rem',
        }}
      >
        {title}
      </h2>
      <div style={{ margin: 0 }}>{children}</div>
    </div>
  );
}
