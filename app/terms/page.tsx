import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'XDrive Logistics Ltd Terms and Conditions for the use of our transport platform and services.',
};

const LAST_UPDATED = '20 February 2026';

export default function TermsPage() {
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
          Terms &amp; Conditions
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.7', color: 'rgba(255,255,255,0.82)' }}>
          <Section title="1. Introduction">
            These Terms and Conditions (&quot;Terms&quot;) govern your use of the XDrive Logistics platform and services
            operated by XDrive Logistics Ltd, a company registered in England and Wales (Company Number 13171804),
            with a registered office at 101 Cornelian Street, Blackburn, BB1 9QL, United Kingdom.
            <br /><br />
            By accessing or using our platform, you agree to be bound by these Terms. If you do not agree,
            please do not use our services.
          </Section>

          <Section title="2. Services">
            XDrive Logistics Ltd provides an online platform connecting self-employed courier drivers with
            businesses and individuals requiring freight and transport services. We act as an intermediary
            and are not a party to the contract between drivers and clients unless explicitly stated.
          </Section>

          <Section title="3. User Accounts">
            To use certain features of the platform, you must create an account. You are responsible for
            maintaining the confidentiality of your login credentials and for all activities that occur
            under your account. You must notify us immediately of any unauthorised use.
          </Section>

          <Section title="4. Driver Requirements">
            All drivers registered on the platform must hold valid and appropriate qualifications,
            including but not limited to: a Certificate of Professional Competence (CPC), a valid
            tachograph card, comprehensive goods-in-transit insurance, and any other licences
            required by UK law. XDrive Logistics reserves the right to verify these documents
            and to remove any driver who does not comply.
          </Section>

          <Section title="5. Payments & Fees">
            Payment terms are agreed between clients and drivers through the platform. XDrive Logistics
            may charge a service fee or commission as outlined at the time of booking. Invoices are
            issued for all transactions. Late payments may incur administrative charges of £25 per
            full week beyond the agreed due date.
          </Section>

          <Section title="6. Liability">
            XDrive Logistics Ltd shall not be liable for any indirect, incidental, or consequential
            loss arising from the use of the platform. Our total liability to you shall not exceed
            the amount paid by you to us in the three months preceding the claim.
            <br /><br />
            We do not guarantee the availability, accuracy, or reliability of the platform at all times.
          </Section>

          <Section title="7. Intellectual Property">
            All content, trademarks, and intellectual property on this platform are owned by or
            licensed to XDrive Logistics Ltd. You may not reproduce, distribute, or create derivative
            works without our prior written consent.
          </Section>

          <Section title="8. Governing Law">
            These Terms are governed by the laws of England and Wales. Any disputes shall be subject
            to the exclusive jurisdiction of the courts of England and Wales.
          </Section>

          <Section title="9. Changes to Terms">
            We reserve the right to update these Terms at any time. Changes will be published on this
            page with an updated &quot;Last updated&quot; date. Continued use of the platform after changes
            constitutes acceptance of the new Terms.
          </Section>

          <Section title="10. Contact">
            If you have any questions about these Terms, please contact us at:<br /><br />
            XDrive Logistics Ltd<br />
            101 Cornelian Street, Blackburn, BB1 9QL<br />
            Email: xdrivelogisticsltd@gmail.com<br />
            Phone: 07423 272 138
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
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}
