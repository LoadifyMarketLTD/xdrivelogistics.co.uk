'use client';

import { useState } from 'react';
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
            {success && (
              <div style={{ backgroundColor: 'rgba(46,125,50,0.25)', border: '1px solid #4CAF50', borderRadius: '10px', padding: '0.75rem' }}>
                ✅ Request sent successfully.
              </div>
            )}
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
