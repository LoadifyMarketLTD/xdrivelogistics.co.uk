'use client'

import Link from 'next/link'

export default function ShipmentCard({ shipment }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="border border-slate-800 rounded-lg p-4 bg-slate-900 hover:bg-slate-800 transition">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">
            {shipment.pickup_location} → {shipment.delivery_location}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Pickup: {formatDate(shipment.pickup_date)}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            shipment.status === 'pending'
              ? 'bg-yellow-500/20 text-yellow-400'
              : shipment.status === 'accepted'
              ? 'bg-emerald-500/20 text-emerald-400'
              : shipment.status === 'completed'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-slate-500/20 text-slate-400'
          }`}
        >
          {shipment.status}
        </span>
      </div>

      {shipment.description && (
        <p className="text-sm text-slate-300 mb-3 line-clamp-2">
          {shipment.description}
        </p>
      )}

      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-400">
          {shipment.weight && <span>Weight: {shipment.weight}kg</span>}
        </div>
        {shipment.price && (
          <div className="text-lg font-semibold text-emerald-400">
            £{shipment.price}
          </div>
        )}
      </div>

      <Link
        href={`/shipments/${shipment.id}`}
        className="inline-block text-emerald-500 hover:text-emerald-400 text-sm font-medium"
      >
        View Details →
      </Link>
    </div>
  );
        className="mt-3 block w-full text-center bg-slate-700 hover:bg-slate-600 text-slate-50 py-2 rounded text-sm font-medium transition"
      >
        View Details
      </Link>
    </div>
  )
}
