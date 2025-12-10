"use client";

import { useMemo, useState } from 'react';
import LoadCard from '../../components/load-card';
import Filters from '../../components/filters';
import { mockLoads } from '../../lib/mock-loads';

export default function LoadsPage() {
  const [filters, setFilters] = useState({
    vehicleType: 'all',
    maxDistance: '',
    minPrice: '',
    maxPrice: '',
    search: '',
  });

  const filteredLoads = useMemo(() => {
    return mockLoads.filter((load) => {
      if (filters.vehicleType !== 'all' && load.vehicleType !== filters.vehicleType) {
        return false;
      }

      if (filters.maxDistance && load.distanceKm > Number(filters.maxDistance)) {
        return false;
      }

      if (filters.minPrice && load.priceGBP < Number(filters.minPrice)) {
        return false;
      }

      if (filters.maxPrice && load.priceGBP > Number(filters.maxPrice)) {
        return false;
      }

      if (filters.search) {
        const term = filters.search.toLowerCase();
        const inPickup = load.pickupLocation.toLowerCase().includes(term);
        const inDelivery = load.deliveryLocation.toLowerCase().includes(term);
        const inRef = load.ref.toLowerCase().includes(term);

        if (!inPickup && !inDelivery && !inRef) return false;
      }

      return true;
    });
  }, [filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Available Loads
          </h1>
          <p className="text-sm text-slate-500">
            Browse and filter live loads similar to Courier Exchange: ref, route, vehicle, rate per job.
          </p>
        </div>
      </div>

      <Filters filters={filters} onChange={setFilters} />

      <div className="grid gap-4">
        {filteredLoads.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No loads match your filters. Try clearing some filters or widening distance/price.
          </div>
        )}

        {filteredLoads.map((load) => (
          <LoadCard key={load.id} load={load} />
        ))}
      </div>
    </div>
  );
}
