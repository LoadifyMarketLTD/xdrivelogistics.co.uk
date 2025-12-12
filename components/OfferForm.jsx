'use client'

import { useState } from 'react'
import supabaseClient from '../lib/supabaseClient'

export default function OfferForm({ shipmentId, onOfferSubmitted }) {
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized')
      }

      // Get current session token
      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('You must be logged in to submit an offer')
      }

      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          shipment_id: shipmentId,
          price: parseFloat(price),
          notes: notes || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit offer')
      }

      setSuccess(true)
      setPrice('')
      setNotes('')
      
      // Notify parent component
      if (onOfferSubmitted) {
        onOfferSubmitted()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Your Offer Price (£)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="150.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Any additional information about your offer..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded px-3 py-2">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded px-3 py-2">
            Offer submitted successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Offer'}
        </button>
      </form>
    </div>
  )
}
