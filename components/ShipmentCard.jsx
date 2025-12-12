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
        className="inline-block text-emerald-500 hover:text-emerald-400 text-sm font-medium"
      >
        View Details →
      </Link>
    </div>
  );
}
