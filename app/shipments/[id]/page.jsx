"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import OfferForm from '@/components/OfferForm';
import Link from 'next/link';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState(null);
  const [offers, setOffers] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    loadShipment();
    loadOffers();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadShipment = async () => {
    try {
      const response = await fetch(`/api/shipments/${params.id}`);
      const data = await response.json();
      setShipment(data.shipment);
    } catch (error) {
      console.error('Error loading shipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async () => {
    try {
      const response = await fetch(`/api/offers?shipmentId=${params.id}`);
      const data = await response.json();
      setOffers(data.offers || []);
    } catch (error) {
      console.error('Error loading offers:', error);
    }
  };

  const handleOfferSubmitted = () => {
    loadOffers();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Shipment not found</div>
      </div>
    );
  }

  const userRole = user?.user_metadata?.role;
  const isDriver = userRole === 'driver';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/shipments"
            className="text-sm text-slate-400 hover:text-slate-50"
          >
            ← Back to Shipments
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Shipment Details */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-2xl font-semibold">
                {shipment.pickup_location} → {shipment.delivery_location}
              </h1>
              <span className="px-3 py-1 bg-slate-800 rounded-full text-xs capitalize">
                {shipment.status}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="text-slate-400 mb-2">Pickup Details</h3>
                <p className="mb-1">{shipment.pickup_location}</p>
                <p className="text-slate-400">
                  Date: {new Date(shipment.pickup_date).toLocaleString()}
                </p>
              </div>

              <div>
                <h3 className="text-slate-400 mb-2">Delivery Details</h3>
                <p className="mb-1">{shipment.delivery_location}</p>
              </div>

              <div>
                <h3 className="text-slate-400 mb-2">Cargo Information</h3>
                <p className="capitalize">Type: {shipment.cargo_type}</p>
                <p>Weight: {shipment.weight}kg</p>
              </div>

              <div>
                <h3 className="text-slate-400 mb-2">Created</h3>
                <p>{new Date(shipment.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Offers Section */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Offers ({offers.length})</h2>
            
            {offers.length === 0 ? (
              <p className="text-slate-400 text-sm">No offers yet</p>
            ) : (
              <div className="space-y-3">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold">£{offer.price}</div>
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs capitalize">
                        {offer.status}
                      </span>
                    </div>
                    {offer.notes && (
                      <p className="text-sm text-slate-400">{offer.notes}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(offer.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offer Form for Drivers */}
          {user && isDriver && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Submit Your Offer</h2>
              <OfferForm
                shipmentId={params.id}
                driverId={user.id}
                onOfferSubmitted={handleOfferSubmitted}
              />
            </div>
          )}

          {!user && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 text-center">
              <p className="text-slate-400 mb-4">
                Please log in to submit an offer
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-md hover:bg-emerald-400"
              >
                Log In
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
