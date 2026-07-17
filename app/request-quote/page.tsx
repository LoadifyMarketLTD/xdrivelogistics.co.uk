'use client';

import { useState } from 'react';
import Image from 'next/image';
import { COMPANY_CONFIG } from '../config/company';
import { useCompanyContactLinks } from '../hooks/useCompanyContactLinks';

type CargoType = 'pallets' | 'parcels' | 'furniture' | 'documents' | 'other';

export default function RequestQuotePage() {
  const { phoneHref, whatsappDefaultMessageHref } = useCompanyContactLinks();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    pickupLocation: '',
    deliveryLocation: '',
    cargoType: 'parcels' as CargoType,
    quantity: '',
    notes: '',
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    const response = await fetch('/api/public/quote-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setLoading(false);
      setError(payload.error || 'Unable to submit quote request right now.');
      return;
    }

    setLoading(false);
    setSuccess(true);
    setForm({
      fullName: '',
      email: '',
      phone: '',
      pickupLocation: '',
      deliveryLocation: '',
      cargoType: 'parcels',
      quantity: '',
      notes: '',
    });
    // Scroll to top so the success card is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.8rem 0.9rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#fff',
    fontSize: '0.95rem',
  };

  if (success) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0A2239 0%, #1F3A5F 60%, #0A2239 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <Image src="/xdrive-logo.jpeg" alt="XDrive Logistics" width={180} height={40} style={{ width: 'auto', height: '40px', margin: '0 auto' }} />
          </div>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.8rem', color: '#fff' }}>
            Quote Request Received!
          </h1>
          <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
            Thank you — our team will review your request and come back to you with a
            competitive quote. This usually takes less than an hour during business hours.
          </p>
          <div
            style={{
              backgroundColor: 'rgba(46,125,50,0.15)',
              border: '1px solid rgba(46,125,50,0.35)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1.75rem',
              textAlign: 'left',
              display: 'grid',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#81C784', marginBottom: '0.25rem' }}>
              ⏱ What happens next?
            </div>
            {[
              '1. We review your shipment details',
              '2. We confirm availability and pricing',
              '3. You receive a quote via email or WhatsApp',
              '4. Confirm booking and schedule pickup',
            ].map((step) => (
              <div key={step} style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>
                {step}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={whatsappDefaultMessageHref}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#25D366',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              WhatsApp Us
            </a>
            <a
              href="/"
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              Back to Homepage
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A2239 0%, #1F3A5F 60%, #0A2239 100%)',
        color: '#fff',
        padding: '2rem 1rem 3rem',
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
        <div>
          <Image src="/xdrive-logo.jpeg" alt="XDrive Logistics" width={180} height={40} priority style={{ width: 'auto', height: '40px' }} />
        </div>
        <a href="/" style={{ color: '#D4AF37', textDecoration: 'none', fontWeight: 700 }}>
          ← Back to homepage
        </a>

        <section style={{ display: 'grid', gap: '0.8rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem,4vw,2.4rem)' }}>Request a Quote</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)' }}>
            Marketing → Quote request → Admin processing starts here.
          </p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }} className="quote-grid">
          <form
            onSubmit={onSubmit}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'grid',
              gap: '0.85rem',
            }}
          >
            {error && (
              <div style={{ backgroundColor: 'rgba(185,28,28,0.25)', border: '1px solid #ef4444', borderRadius: '10px', padding: '0.75rem' }}>
                {error}
              </div>
            )}

            <input required placeholder="Full Name *" value={form.fullName} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
            <input required type="email" placeholder="Email *" value={form.email} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            <input placeholder="Phone" value={form.phone} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
            <input required placeholder="Pickup Location *" value={form.pickupLocation} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, pickupLocation: e.target.value }))} />
            <input required placeholder="Delivery Location *" value={form.deliveryLocation} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, deliveryLocation: e.target.value }))} />
            <select value={form.cargoType} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, cargoType: e.target.value as CargoType }))}>
              <option value="pallets">Pallets</option>
              <option value="parcels">Parcels</option>
              <option value="furniture">Furniture</option>
              <option value="documents">Documents</option>
              <option value="other">Other</option>
            </select>
            <input placeholder="Quantity (optional)" value={form.quantity} style={fieldStyle} onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))} />
            <textarea placeholder="Notes (optional)" value={form.notes} style={{ ...fieldStyle, minHeight: '110px', resize: 'vertical' }} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
            <button
              type="submit"
              disabled={loading}
              style={{
                border: 'none',
                borderRadius: '10px',
                backgroundColor: '#1F7A3D',
                color: '#fff',
                fontWeight: 700,
                padding: '0.9rem 1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending...' : 'Request a Quote'}
            </button>
          </form>

          <aside
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'grid',
              gap: '0.7rem',
              alignContent: 'start',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Need instant contact?</h2>
            <a href={whatsappDefaultMessageHref} style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#25D366', borderRadius: '8px', padding: '0.7rem 0.8rem', fontWeight: 700 }}>WhatsApp</a>
            <a href={phoneHref} style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#1F3A5F', borderRadius: '8px', padding: '0.7rem 0.8rem', fontWeight: 700 }}>Call {COMPANY_CONFIG.phoneDisplay}</a>
            <a href={`mailto:${COMPANY_CONFIG.email}`} style={{ color: '#fff', textDecoration: 'none', backgroundColor: '#1F3A5F', borderRadius: '8px', padding: '0.7rem 0.8rem', fontWeight: 700 }}>{COMPANY_CONFIG.email}</a>
          </aside>
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 900px) {
          .quote-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
