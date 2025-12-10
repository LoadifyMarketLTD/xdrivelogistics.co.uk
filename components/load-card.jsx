export default function LoadCard({ load }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {load.ref}
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            {load.pickupLocation} &rarr; {load.deliveryLocation}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Price</p>
          <p className="text-base font-bold text-emerald-600">&pound;{load.priceGBP.toFixed(0)}</p>
        </div>
      </header>

      <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-700">Pickup</p>
          <p>{load.pickupTime}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">Vehicle</p>
          <p>{load.vehicleType} • {load.loadType}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">Distance</p>
          <p>{load.distanceKm} km</p>
        </div>
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <p>Pallets: {load.pallets} • Weight: {load.weightKg} kg</p>
        <p className="font-medium text-slate-700">{load.companyName}</p>
      </footer>
    </article>
  );
}
