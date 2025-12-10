'use client'

import { useMemo, useState } from 'react'

const MOCK_LOADS = [
  {
    id: 'CX-102345',
    pickupTown: 'Manchester',
    pickupPostcode: 'M17 1AB',
    deliveryTown: 'London',
    deliveryPostcode: 'E15 3QQ',
    vehicle: 'Luton',
    weight: '800 kg',
    pickupTime: 'Today 14:30',
    distance: '208 mi',
    price: 260,
    isReturn: false,
    notes: 'Tail-lift required, booking ref 8872',
  },
  {
    id: 'CX-102346',
    pickupTown: 'Leeds',
    pickupPostcode: 'LS10 1AA',
    deliveryTown: 'Birmingham',
    deliveryPostcode: 'B7 4BN',
    vehicle: 'XLWB Van',
    weight: '450 kg',
    pickupTime: 'Today 16:00',
    distance: '118 mi',
    price: 180,
    isReturn: true,
    notes: 'Return load available to Leeds',
  },
  {
    id: 'CX-102347',
    pickupTown: 'Blackburn',
    pickupPostcode: 'BB1 9QL',
    deliveryTown: 'Glasgow',
    deliveryPostcode: 'G4 0BA',
    vehicle: 'Luton',
    weight: '700 kg',
    pickupTime: 'Tomorrow 08:30',
    distance: '210 mi',
    price: 320,
    isReturn: false,
    notes: 'Overnight, goods on pallets',
  },
  {
    id: 'CX-102348',
    pickupTown: 'London',
    pickupPostcode: 'NW10 7NZ',
    deliveryTown: 'Bristol',
    deliveryPostcode: 'BS2 0SP',
    vehicle: 'SWB Van',
    weight: '150 kg',
    pickupTime: 'Today 19:00',
    distance: '117 mi',
    price: 140,
    isReturn: false,
    notes: 'Evening collection, office move boxes',
  },
]

const VEHICLE_TYPES = ['Any vehicle', 'SWB Van', 'XLWB Van', 'Luton']

export default function LoadsPage() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [vehicle, setVehicle] = useState('Any vehicle')
  const [minPrice, setMinPrice] = useState('')

  const filteredLoads = useMemo(() => {
    return MOCK_LOADS.filter((load) => {
      const matchesOrigin =
        !origin ||
        load.pickupTown.toLowerCase().includes(origin.toLowerCase()) ||
        load.pickupPostcode.toLowerCase().includes(origin.toLowerCase())

      const matchesDestination =
        !destination ||
        load.deliveryTown.toLowerCase().includes(destination.toLowerCase()) ||
        load.deliveryPostcode.toLowerCase().includes(destination.toLowerCase())

      const matchesVehicle =
        vehicle === 'Any vehicle' || load.vehicle === vehicle

      const matchesPrice =
        !minPrice || load.price >= Number(minPrice || 0)

      return matchesOrigin && matchesDestination && matchesVehicle && matchesPrice
    })
  }, [origin, destination, vehicle, minPrice])

  return (
    <main className="min-h-[calc(100vh-140px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Titlu + info */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Live loads board
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-50 mt-2">
              Available loads on{' '}
              <span className="text-[#D4AF37]">XDrive Logistics</span>
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-xl">
              Search for same-day and next-day courier jobs across the UK. Filter by
              route, vehicle type and minimum price to find the loads that fit your van.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-300 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-200">Total loads</span>
              <span className="text-[#D4AF37] font-semibold">
                {filteredLoads.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Demo data only – in etapa următoare vom conecta direct la baza ta din Neon
              pentru joburi reale.
            </p>
          </div>
        </header>

        {/* Filtre */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                From (town / postcode)
              </label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Blackburn / BB1"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                To (town / postcode)
              </label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. London / E15"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Vehicle
              </label>
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              >
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Minimum price (£)
              </label>
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="e.g. 150"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="flex gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => {
                  setOrigin('')
                  setDestination('')
                  setVehicle('Any vehicle')
                  setMinPrice('')
                }}
                className="flex-1 md:flex-none rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition"
              >
                Reset filters
