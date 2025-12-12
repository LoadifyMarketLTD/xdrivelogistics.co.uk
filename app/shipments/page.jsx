'use client'

import { useState, useEffect } from 'react'
import ShipmentCard from '../../components/ShipmentCard'

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchShipments()
  }, [])

  const fetchShipments = async () => {
    try {
      const response = await fetch('/api/shipments?limit=100')
      const data = await response.json()

      if (response.ok) {
        setShipments(data.shipments || [])
      } else {
        throw new Error(data.error || 'Failed to fetch shipments')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading shipments...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">All Shipments</h1>
          <p className="text-slate-400 text-sm">
            Browse all available shipments
          </p>
        </div>

        {error && (
          <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded px-4 py-3">
            {error}
          </div>
        )}

        {shipments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg mb-2">No shipments available</p>
            <p className="text-sm">Check back later</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shipments.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
