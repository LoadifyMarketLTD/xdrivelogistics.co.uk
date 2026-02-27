import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'XDrive Logistics Privacy Policy — how we collect, use, and protect your personal data in accordance with UK GDPR.',
};

const LAST_UPDATED = '20 February 2026';

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.7', color: 'rgba(255,255,255,0.82)' }}>
          <Section title="1. Who We Are">
            XDrive Logistics Ltd (Company Number 13171804), registered at 101 Cornelian Street,
            Blackburn, BB1 9QL, United Kingdom, is the data controller for personal data collected
            through this platform. We are committed to protecting your privacy in accordance with
            the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
          </Section>

          <Section title="2. Data We Collect">
            We may collect the following personal data:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Name, email address, and phone number</li>
              <li>Business name and address</li>
              <li>Driver licence, CPC certificate, and other professional documents (for drivers)</li>
              <li>Payment information (processed securely; we do not store full card details)</li>
              <li>IP address, browser type, and usage data via cookies</li>
              <li>Delivery and job history</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Data">
            We use your personal data to:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Provide and manage platform services</li>
              <li>Verify driver qualifications and identity</li>
              <li>Process payments and issue invoices</li>
              <li>Communicate about your bookings and account</li>
              <li>Improve our platform and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing">
            We process your data on the following legal bases:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li><strong>Contract</strong>: to provide the services you have requested</li>
              <li><strong>Legal obligation</strong>: to comply with applicable laws</li>
              <li><strong>Legitimate interests</strong>: to improve our platform and prevent fraud</li>
              <li><strong>Consent</strong>: for marketing communications (you may withdraw at any time)</li>
            </ul>
          </Section>

          <Section title="5. Data Sharing">
            We do not sell your personal data. We may share your data with:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Drivers and clients as necessary to facilitate a booking</li>
              <li>Payment processors (e.g., Stripe, GoCardless)</li>
              <li>Cloud service providers (e.g., Supabase/AWS) for data hosting</li>
              <li>Legal authorities when required by law</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            We retain your personal data for as long as your account is active and for up to 7 years
            after account closure for legal and tax purposes, unless a shorter period is required or
            permitted by law.
          </Section>

          <Section title="7. Your Rights">
            Under UK GDPR, you have the right to:
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li>Object to or restrict processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            To exercise any of these rights, contact us at dannycourierltd@gmail.com.
          </Section>

          <Section title="8. Cookies">
            We use cookies to improve your experience. See our{' '}
            <a href="/cookies" style={{ color: 'var(--color-gold-primary)' }}>
              Cookie Policy
            </a>{' '}
            for full details.
          </Section>

          <Section title="9. Security">
            We implement industry-standard security measures including SSL/TLS encryption,
            secure data storage, and access controls. However, no system is completely secure
            and we cannot guarantee absolute security.
          </Section>

          <Section title="10. Contact & Complaints">
            For privacy-related queries, contact us at:<br /><br />
            XDrive Logistics Ltd<br />
            101 Cornelian Street, Blackburn, BB1 9QL<br />
            Email: dannycourierltd@gmail.com<br /><br />
            You also have the right to lodge a complaint with the UK Information Commissioner&apos;s
            Office (ICO) at{' '}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-gold-primary)' }}>
              ico.org.uk
            </a>.
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
