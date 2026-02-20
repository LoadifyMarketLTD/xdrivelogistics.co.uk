'use client';

import { useEffect, useRef, useState } from 'react';
import { Section } from '../ui/Section';

const TESTIMONIALS = [
  {
    name: 'Sarah Johnson',
    initials: 'SJ',
    avatarColor: '#2E7D32',
    company: 'Tech Solutions Ltd',
    companyInitials: 'TS',
    role: 'Operations Manager',
    text: 'Danny Courier has been our go-to courier service for over two years. Their reliability and professionalism are unmatched.',
    rating: 5,
    verified: true,
  },
  {
    name: 'Michael Chen',
    initials: 'MC',
    avatarColor: '#1F3A5F',
    company: 'BuildEx Construction',
    companyInitials: 'BC',
    role: 'Project Director',
    text: 'Excellent service for our pallet deliveries. The real-time tracking gives us complete peace of mind.',
    rating: 5,
    verified: true,
  },
  {
    name: 'Emma Thompson',
    initials: 'ET',
    avatarColor: '#7B3F00',
    company: 'Fashion Forward',
    companyInitials: 'FF',
    role: 'E-commerce Manager',
    text: 'Fast, efficient, and always on time. Their customer service team is incredibly responsive and helpful.',
    rating: 5,
    verified: true,
  },
  {
    name: 'David Williams',
    initials: 'DW',
    avatarColor: '#1565C0',
    company: 'Med Supplies Co',
    companyInitials: 'MS',
    role: 'Logistics Coordinator',
    text: 'Professional drivers and secure transport. We trust Danny Courier with our most important deliveries.',
    rating: 5,
    verified: true,
  },
  {
    name: 'Rachel Davies',
    initials: 'RD',
    avatarColor: '#6A0DAD',
    company: 'Green Foods Ltd',
    companyInitials: 'GF',
    role: 'Supply Chain Manager',
    text: 'The temperature-controlled logistics service exceeded our expectations. Every delivery was on time and intact.',
    rating: 5,
    verified: true,
  },
  {
    name: 'James Carter',
    initials: 'JC',
    avatarColor: '#C62828',
    company: 'AutoParts Direct',
    companyInitials: 'AP',
    role: 'Warehouse Manager',
    text: 'We rely on Danny Courier for our daily parts distribution. Consistent, professional, and competitively priced.',
    rating: 5,
    verified: true,
  },
];

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Section backgroundColor="var(--color-primary-navy)">
      <div ref={sectionRef} style={{ paddingTop: '5rem', paddingBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800,
              color: '#FFFFFF',
              marginBottom: '1rem',
            }}
          >
            What Our Clients Say
          </h2>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'rgba(255,255,255,0.7)',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            Trusted by businesses across the UK for reliable transport
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
          }}
          className="testimonials-grid"
        >
          {TESTIMONIALS.map((t, index) => (
            <div
              key={index}
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '1.75rem',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: `${index * 0.08}s`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} style={{ color: '#D4AF37', fontSize: '1.1rem' }}>★</span>
                ))}
              </div>

              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: '1.7',
                  marginBottom: '1.5rem',
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{t.text}&rdquo;
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: t.avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  {t.initials}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {t.name}
                    </span>
                    {t.verified && (
                      <span
                        title="Verified client"
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: '#2E7D32',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          color: '#fff',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', marginBottom: '0.3rem' }}>
                    {t.role}
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      padding: '0.15rem 0.5rem',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        backgroundColor: t.avatarColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.5rem',
                        fontWeight: 700,
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {t.companyInitials[0]}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                      {t.company}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <style jsx>{`
          @media (max-width: 1024px) {
            .testimonials-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 640px) {
            .testimonials-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </Section>
  );
}
