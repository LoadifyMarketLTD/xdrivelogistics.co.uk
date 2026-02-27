'use client';

import { useState } from 'react';
import { Section } from '../ui/Section';

const FAQS = [
  {
    question: 'How do I get a quote for my delivery?',
    answer:
      'You can get an instant quote by contacting us via WhatsApp, calling our number, or sending an email. We respond within minutes during business hours and 24/7 for urgent requests.',
  },
  {
    question: 'What areas do you cover?',
    answer:
      'We provide transport services across the entire UK and into Europe. From local same-day deliveries to cross-border freight, our network covers all major routes.',
  },
  {
    question: 'Are your drivers fully verified and insured?',
    answer:
      'Yes. All drivers on our platform hold valid CPC qualifications, tachograph cards, and comprehensive goods-in-transit insurance. Every driver is vetted before being accepted onto the platform.',
  },
  {
    question: 'What types of goods can you transport?',
    answer:
      'We handle a wide range of freight — from documents and parcels to full pallet loads and larger consignments. Contact us if you have specific requirements and we\'ll advise on the best solution.',
  },
  {
    question: 'How does payment work?',
    answer:
      'We accept BACS bank transfer, PayPal, and other payment methods. Standard payment terms are 14 or 30 days, with options for same-day payment for regular clients. Invoices are provided for every job.',
  },
  {
    question: 'What happens if my delivery is delayed?',
    answer:
      'We proactively communicate any delays in real time. Our drivers update the status of your delivery throughout the journey so you always know where your goods are and when to expect them.',
  },
  {
    question: 'Can I track my delivery in real time?',
    answer:
      'Yes. Once your booking is confirmed, you will receive live status updates. Our operations team monitors every delivery to ensure on-time, safe arrival.',
  },
  {
    question: 'How do I register as a driver?',
    answer:
      'Click "Driver Login" and complete the registration form. You\'ll need to upload your CPC certificate, tachograph card, and proof of insurance. Our team reviews applications within 24 hours.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <Section id="faq" backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-white)',
              marginBottom: '1rem',
            }}
          >
            Frequently Asked Questions
          </h2>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--color-text-white-transparent)',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            Everything you need to know about XDrive Logistics
          </p>
        </div>

        {/* Accordion */}
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {FAQS.map((faq, index) => (
            <div
              key={index}
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: `1px solid ${openIndex === index ? 'var(--color-gold-primary)' : 'var(--glass-border)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                transition: 'border-color 0.3s ease',
              }}
            >
              <button
                onClick={() => toggle(index)}
                aria-expanded={openIndex === index}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-white)',
                }}
              >
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 'var(--font-weight-semibold)',
                    lineHeight: '1.4',
                  }}
                >
                  {faq.question}
                </span>
                <span
                  style={{
                    color: 'var(--color-gold-primary)',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                    transform: openIndex === index ? 'rotate(45deg)' : 'rotate(0)',
                    transition: 'transform 0.3s ease',
                    display: 'inline-block',
                  }}
                >
                  +
                </span>
              </button>

              {openIndex === index && (
                <div
                  style={{
                    padding: '0 1.5rem 1.25rem',
                    borderTop: '1px solid var(--glass-border)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--color-text-white-transparent)',
                      lineHeight: '1.6',
                      margin: '1rem 0 0',
                    }}
                  >
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
