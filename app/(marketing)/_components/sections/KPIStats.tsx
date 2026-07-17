import Link from 'next/link';
import { Section } from '../ui/Section';

type RoleCard = {
  title: string;
  forWho: string;
  canDo: string;
  ctaLabel: string;
  href: string;
};

const ROLE_CARDS: RoleCard[] = [
  {
    title: 'Brokers / Load Posters',
    forWho: 'For brokers and teams posting transport jobs to the exchange.',
    canDo: 'Post loads, collect quotes, award jobs, and move awarded work into operations.',
    ctaLabel: 'Register as Broker',
    href: '/register',
  },
  {
    title: 'Carrier Companies',
    forWho: 'For courier and transport companies managing teams and fleet.',
    canDo: 'Quote on posted work, assign drivers, track delivery progress, and manage POD/invoices.',
    ctaLabel: 'Join as Carrier',
    href: '/register',
  },
  {
    title: 'Owner Operators',
    forWho: 'For self-employed operators running independently.',
    canDo: 'Act as company + dispatcher + driver: quote, deliver, upload POD, and invoice.',
    ctaLabel: 'Join as Owner Operator',
    href: '/register',
  },
  {
    title: 'Drivers',
    forWho: 'For employed and assigned drivers delivering booked work.',
    canDo: 'Receive assigned jobs, complete deliveries, and upload delivery proof (POD).',
    ctaLabel: 'Driver Login',
    href: '/login',
  },
  {
    title: 'Customers',
    forWho: 'For customers requesting transport services and quotes.',
    canDo: 'Submit quote requests and move approved jobs into operational delivery workflow.',
    ctaLabel: 'Request a Quote',
    href: '/request-quote',
  },
];

export function KPIStats() {
  return (
    <Section backgroundColor="#0F2742">
      <div style={{ paddingTop: '3.5rem', paddingBottom: '3.5rem' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.75rem' }}>
          Built for Every Role in the XDrive Exchange
        </h2>
        <p style={{ margin: '0 0 1.6rem', color: 'rgba(255,255,255,0.78)', maxWidth: '820px', lineHeight: 1.6 }}>
          Choose your role and access the workflow designed for how you operate in logistics.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
          {ROLE_CARDS.map((card) => (
            <article
              key={card.title}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '14px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.04rem', lineHeight: 1.35 }}>{card.title}</h3>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', fontSize: '0.9rem', lineHeight: 1.5 }}>{card.forWho}</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', lineHeight: 1.5 }}>{card.canDo}</p>
              <div style={{ marginTop: '0.3rem' }}>
                <Link
                  href={card.href}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.62rem 0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#1F3A5F',
                    color: '#D4AF37',
                    textDecoration: 'none',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                  }}
                >
                  {card.ctaLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
