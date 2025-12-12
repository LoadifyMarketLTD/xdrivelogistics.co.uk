'use client'

import Link from 'next/link'
import { formatDate, formatStatus, getStatusClasses } from '../lib/utils'

export default function ShipmentCard({ shipment }) {
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
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClasses(shipment.status)}`}>
          {formatStatus(shipment.status)}
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
import Link from 'next/link';

export default function ShipmentCard({ shipment }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-lg">
          {shipment.pickup_location} → {shipment.delivery_location}
        </h3>
        <span className="px-2 py-1 bg-slate-800 rounded-full text-xs capitalize">
          {shipment.status}
        </span>
      </div>

      <div className="space-y-2 text-sm text-slate-400 mb-4">
        <div>
          <span className="text-slate-500">Pickup:</span>{' '}
          {new Date(shipment.pickup_date).toLocaleDateString()}
        </div>
        <div>
          <span className="text-slate-500">Cargo:</span>{' '}
          <span className="capitalize">{shipment.cargo_type}</span>
        </div>
        <div>
          <span className="text-slate-500">Weight:</span> {shipment.weight}kg
        </div>
      </div>

      <Link
        href={`/shipments/${shipment.id}`}
        className="mt-3 block w-full text-center bg-slate-700 hover:bg-slate-600 text-slate-50 py-2 rounded text-sm font-medium transition"
      >
        View Details
      </Link>
    </div>
  )
        className="inline-block text-emerald-500 hover:text-emerald-400 text-sm font-medium"
      >
        View Details →
      </Link>
    </div>
  );
}
