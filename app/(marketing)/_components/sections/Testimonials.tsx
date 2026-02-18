'use client';

import { useState, useRef } from 'react';
import { Section } from '../ui/Section';

const TESTIMONIALS = [
  {
    name: 'Sarah Johnson',
    company: 'Tech Solutions Ltd',
    role: 'Operations Manager',
    text: 'XDrive Logistics has been our go-to courier service for over two years. Their reliability and professionalism are unmatched.',
    rating: 5,
  },
  {
    name: 'Michael Chen',
    company: 'BuildEx Construction',
    role: 'Project Director',
    text: 'Excellent service for our pallet deliveries. The real-time tracking gives us complete peace of mind.',
    rating: 5,
  },
  {
    name: 'Emma Thompson',
    company: 'Fashion Forward',
    role: 'E-commerce Manager',
    text: 'Fast, efficient, and always on time. Their customer service team is incredibly responsive and helpful.',
    rating: 5,
  },
  {
    name: 'David Williams',
    company: 'Med Supplies Co',
    role: 'Logistics Coordinator',
    text: 'Professional drivers and secure transport. We trust XDrive with our most important deliveries.',
    rating: 5,
  },
];

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const cardWidth = container.children[0]?.clientWidth || 0;
    const gap = 24; // 1.5rem
    const scrollAmount = cardWidth + gap;

    if (direction === 'right') {
      const newIndex = Math.min(currentIndex + 1, TESTIMONIALS.length - 1);
      setCurrentIndex(newIndex);
      container.scrollTo({
        left: scrollAmount * newIndex,
        behavior: 'smooth',
      });
    } else {
      const newIndex = Math.max(currentIndex - 1, 0);
      setCurrentIndex(newIndex);
      container.scrollTo({
        left: scrollAmount * newIndex,
        behavior: 'smooth',
      });
    }
  };

  return (
    <Section backgroundColor="var(--color-primary-navy)">
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-white)',
              marginBottom: '1rem',
            }}
          >
            What Our Clients Say
          </h2>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--color-text-white-transparent)',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            Trusted by businesses across the UK for reliable transport
          </p>
        </div>

        {/* Carousel Container */}
        <div style={{ position: 'relative', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Testimonials Scroll Container */}
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              gap: '1.5rem',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
            className="hide-scrollbar"
          >
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                style={{
                  minWidth: '100%',
                  scrollSnapAlign: 'start',
                  backgroundColor: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {/* Rating Stars */}
                <div style={{ marginBottom: '1rem' }}>
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <span key={i} style={{ color: 'var(--color-gold-primary)', fontSize: '1.25rem' }}>
                      ★
                    </span>
                  ))}
                </div>

                {/* Testimonial Text */}
                <p
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--color-text-white)',
                    lineHeight: '1.6',
                    marginBottom: '1.5rem',
                    fontStyle: 'italic',
                  }}
                >
                  "{testimonial.text}"
                </p>

                {/* Author Info */}
                <div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-white)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {testimonial.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--color-text-white-transparent)',
                    }}
                  >
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              marginTop: '2rem',
            }}
          >
            <button
              onClick={() => scroll('left')}
              disabled={currentIndex === 0}
              aria-label="Previous testimonial"
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: currentIndex === 0 ? 'rgba(255,255,255,0.1)' : 'var(--color-gold-primary)',
                color: currentIndex === 0 ? 'rgba(255,255,255,0.3)' : 'var(--color-primary-navy-dark)',
                border: 'none',
                fontSize: '1.5rem',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ←
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={currentIndex === TESTIMONIALS.length - 1}
              aria-label="Next testimonial"
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: currentIndex === TESTIMONIALS.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--color-gold-primary)',
                color: currentIndex === TESTIMONIALS.length - 1 ? 'rgba(255,255,255,0.3)' : 'var(--color-primary-navy-dark)',
                border: 'none',
                fontSize: '1.5rem',
                cursor: currentIndex === TESTIMONIALS.length - 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              →
            </button>
          </div>

          {/* Dot Indicators */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '1rem',
            }}
          >
            {TESTIMONIALS.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  if (scrollContainerRef.current) {
                    const container = scrollContainerRef.current;
                    const cardWidth = container.children[0]?.clientWidth || 0;
                    const gap = 24;
                    container.scrollTo({
                      left: (cardWidth + gap) * index,
                      behavior: 'smooth',
                    });
                  }
                }}
                aria-label={`Go to testimonial ${index + 1}`}
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  backgroundColor: currentIndex === index ? 'var(--color-gold-primary)' : 'rgba(255,255,255,0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Hide scrollbar CSS */}
        <style jsx>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </Section>
  );
}
