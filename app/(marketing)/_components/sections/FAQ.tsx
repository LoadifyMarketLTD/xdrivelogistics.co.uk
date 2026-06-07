'use client';

import { useState } from 'react';
import { faqs } from '../content';
import { Section } from '../ui/Section';

export function FAQ() {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set([0, 1, 2, 3]));

  function toggle(index: number) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <Section id="faq" backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
          Frequently Asked Questions
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Clear answers about platform scope, early access, finance records and the current MVP position.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {faqs.map((faq, index) => {
            const isOpen = openSet.has(index);
            return (
              <article
                key={faq.q}
                style={{
                  backgroundColor: 'var(--glass-bg)',
                  border: `1px solid ${isOpen ? 'var(--color-gold-primary)' : 'var(--glass-border)'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'none',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.45 }}>{faq.q}</span>
                  <span style={{ color: '#D4AF37', fontSize: '1.1rem', flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--glass-border)', padding: '0.9rem 1rem 1rem' }}>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.84)', lineHeight: 1.6, fontSize: '0.92rem' }}>{faq.a}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
