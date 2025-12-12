'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import supabaseClient from '../../../lib/supabaseClient'
import OfferForm from '../../../components/OfferForm'

export default function ShipmentDetailPage({ params }) {
  const router = useRouter()
  const [shipment, setShipment] = useState(null)
  const [offers, setOffers] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkUser()
    fetchShipmentDetails()
  }, [params.id])

  const checkUser = async () => {
    try {
      if (!supabaseClient) return

      const { data: { user } } = await supabaseClient.auth.getUser()
      setUser(user)
    } catch (err) {
      console.error('Error checking user:', err)
    }
  }

  const fetchShipmentDetails = async () => {
    try {
      const response = await fetch(`/api/shipments/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setShipment(data.shipment)
        setOffers(data.offers || [])
      } else {
        throw new Error(data.error || 'Failed to fetch shipment')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOfferSubmitted = () => {
    // Refresh the shipment details to show the new offer
    fetchShipmentDetails()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-red-400 text-lg mb-4">{error || 'Shipment not found'}</p>
            <a
              href="/shipments"
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              Back to shipments
            </a>
          </div>
        </div>
      </div>
    )
  }

  const isDriver = user?.user_metadata?.role === 'driver'
  const canMakeOffer = isDriver && shipment.status === 'open'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back
        </button>

        {/* Shipment details */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold">{shipment.title}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              shipment.status === 'open' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-slate-700 text-slate-300'
            }`}>
              {shipment.status}
            </span>
          </div>

          {shipment.description && (
            <p className="text-slate-300 mb-4">{shipment.description}</p>
          )}

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Origin:</span>
              <div className="font-medium">{shipment.origin}</div>
            </div>
            <div>
              <span className="text-slate-400">Destination:</span>
              <div className="font-medium">{shipment.destination}</div>
            </div>
            {shipment.price_estimate && (
              <div>
                <span className="text-slate-400">Price Estimate:</span>
                <div className="font-medium">£{parseFloat(shipment.price_estimate).toFixed(2)}</div>
              </div>
            )}
            <div>
              <span className="text-slate-400">Posted:</span>
              <div className="font-medium">
                {new Date(shipment.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Offers section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">
            Offers ({offers.length})
          </h2>

          {offers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
              No offers yet
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-emerald-400">
                      £{parseFloat(offer.price).toFixed(2)}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      offer.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : offer.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {offer.status}
                    </span>
                  </div>
                  {offer.notes && (
                    <p className="text-sm text-slate-300">{offer.notes}</p>
                  )}
                  <div className="text-xs text-slate-500 mt-2">
                    {new Date(offer.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offer form for drivers */}
        {canMakeOffer && (
          <div>
            <h2 className="text-xl font-bold mb-4">Submit Your Offer</h2>
            <OfferForm
              shipmentId={params.id}
              onOfferSubmitted={handleOfferSubmitted}
            />
          </div>
        )}

        {!user && shipment.status === 'open' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center">
            <p className="text-slate-300 mb-4">
              Want to make an offer on this shipment?
            </p>
            <a
              href="/login"
              className="inline-block px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md"
            >
              Log in as Driver
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
