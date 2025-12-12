import Link from 'next/link'

export default function ShipmentCard({ shipment }) {
  return (
    <Link href={`/shipments/${shipment.id}`}>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors cursor-pointer h-full">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg text-slate-50 line-clamp-1">
            {shipment.title}
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ml-2 ${
            shipment.status === 'open' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-slate-700 text-slate-300'
          }`}>
            {shipment.status}
          </span>
        </div>

        {shipment.description && (
          <p className="text-sm text-slate-400 mb-3 line-clamp-2">
            {shipment.description}
          </p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-slate-500 shrink-0">From:</span>
            <span className="text-slate-300 line-clamp-1">{shipment.origin}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-slate-500 shrink-0">To:</span>
            <span className="text-slate-300 line-clamp-1">{shipment.destination}</span>
          </div>
          {shipment.price_estimate && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <span className="text-slate-500">Est. Price:</span>
              <span className="text-emerald-400 font-semibold">
                £{parseFloat(shipment.price_estimate).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Posted {new Date(shipment.created_at).toLocaleDateString()}
        </div>
      </div>
    </Link>
  )
}
