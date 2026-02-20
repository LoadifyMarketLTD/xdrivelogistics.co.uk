'use client';

import { useEffect, useRef, useState } from 'react';

const STATS = [
  { value: '5,000+', label: 'Deliveries Completed', icon: '📦', description: 'successful routes' },
  { value: '99.8%', label: 'On-Time Rate', icon: '⏱️', description: 'delivery precision' },
  { value: '24/7', label: 'Availability', icon: '🕐', description: 'always reachable' },
  { value: 'UK & EU', label: 'Coverage Area', icon: '🌍', description: 'cross-border logistics' },
];

export function KPIStats() {
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
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        backgroundColor: '#F4F6F8',
        padding: '5rem 0',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: '3rem',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 800,
              color: '#1C1C1C',
              marginBottom: '0.75rem',
            }}
          >
            Platform Performance
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#555', maxWidth: '500px', margin: '0 auto' }}>
            Real numbers that prove our reliability
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '2rem',
          }}
        >
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                textAlign: 'center',
                boxShadow: '0 4px 24px rgba(31, 58, 95, 0.08)',
                border: '1px solid rgba(31, 58, 95, 0.06)',
                transition: 'all 0.3s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transitionDelay: `${index * 0.1}s`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(31, 58, 95, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(31, 58, 95, 0.08)';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{stat.icon}</div>
              <div
                style={{
                  fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                  fontWeight: 800,
                  color: '#1F3A5F',
                  lineHeight: '1',
                  marginBottom: '0.5rem',
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  width: visible ? '40px' : '0px',
                  height: '3px',
                  backgroundColor: '#2E7D32',
                  borderRadius: '2px',
                  margin: '0.75rem auto',
                  transition: `width 0.6s ease ${index * 0.15 + 0.3}s`,
                }}
              />
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1C1C1C', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
