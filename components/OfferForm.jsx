"use client";

import { useState } from 'react';

export default function OfferForm({ shipmentId, driverId, onOfferSubmitted }) {
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipment_id: shipmentId,
          driver_id: driverId,
          price: parseFloat(price),
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit offer');
      }

      setSuccess(true);
      setPrice('');
      setNotes('');
      
      // Call parent callback to refresh offers
      if (onOfferSubmitted) {
        onOfferSubmitted();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          Offer submitted successfully!
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm text-slate-300">
          Your Price (£)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="150.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm text-slate-300">
          Notes (Optional)
        </label>
        <textarea
          placeholder="Additional information about your offer..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Offer'}
      </button>
    </form>
  );
}
