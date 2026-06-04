'use client';

import { useState } from 'react';
import { Section } from '../ui/Section';

const FAQS = [
  {
    question: 'What is XDrive?',
    answer: 'XDrive is a logistics exchange and operations platform where transport work can move from request and quote through assignment, delivery, POD, and invoicing.',
  },
  {
    question: 'Is it like Courier Exchange?',
    answer: 'XDrive serves a similar exchange-style use case for logistics workflows, but it is an independent platform operated by XDrive Logistics Ltd.',
  },
  {
    question: 'Can owner operators use it?',
    answer: 'Yes. Owner operators are supported as a dedicated user type and can run quoting, job management, delivery, POD, and invoicing workflows.',
  },
  {
    question: 'Can companies add drivers?',
    answer: 'Yes. Carrier companies can operate with company-level access and assign work to their drivers in operational workflows.',
  },
  {
    question: 'Can brokers post loads?',
    answer: 'Yes. Brokers/load posters can publish work to the exchange so carriers and owner operators can quote.',
  },
  {
    question: 'Can customers request quotes?',
    answer: 'Yes. Customers can submit transport quote requests through the public request flow.',
  },
  {
    question: 'Is live tracking available?',
    answer: 'Not as a full live GPS network. The platform currently focuses on operational status flow, delivery execution, and POD/invoice workflow.',
  },
  {
    question: 'Is the platform fully launched?',
    answer: 'No. XDrive is early-stage and in active development, with core exchange and operations capabilities continuing to evolve.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq" backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
          Frequently Asked Questions
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Clear answers about platform scope and current stage.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {FAQS.map((faq, index) => (
            <article
              key={faq.question}
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: `1px solid ${openIndex === index ? 'var(--color-gold-primary)' : 'var(--glass-border)'}`,
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
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
                <span style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.45 }}>{faq.question}</span>
                <span style={{ color: '#D4AF37', fontSize: '1.1rem', flexShrink: 0 }}>{openIndex === index ? '−' : '+'}</span>
              </button>
              {openIndex === index && (
                <div style={{ borderTop: '1px solid var(--glass-border)', padding: '0.9rem 1rem 1rem' }}>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.84)', lineHeight: 1.6, fontSize: '0.92rem' }}>{faq.answer}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
