'use client'

import { useState } from 'react'
import { supabaseClient } from '../lib/supabaseClient'

export default function OfferForm({ shipmentId, onSuccess }) {
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get current user session
      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (!session) {
        setError('You must be logged in to create an offer')
        setLoading(false)
        return
      }

      // Create offer via API
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          shipment_id: shipmentId,
          price: parseFloat(price),
          notes,
          estimated_delivery_date: estimatedDeliveryDate || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create offer')
      }

      // Reset form
      setPrice('')
      setNotes('')
      setEstimatedDeliveryDate('')
      
      if (onSuccess) {
        onSuccess(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-slate-50 mb-4">Make an Offer</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="price" className="block text-sm text-slate-300 mb-1">
            Price (£) *
          </label>
          <input
            type="number"
            id="price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            step="0.01"
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
            placeholder="e.g., 150.00"
          />
        </div>

        <div>
          <label htmlFor="estimatedDeliveryDate" className="block text-sm text-slate-300 mb-1">
            Estimated Delivery Date
          </label>
          <input
            type="date"
            id="estimatedDeliveryDate"
            value={estimatedDeliveryDate}
            onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm text-slate-300 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="3"
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
            placeholder="Add any additional information about your offer..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit Offer'}
        </button>
      </div>
    </form>
  )
}
