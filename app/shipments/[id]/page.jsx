"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '../../../lib/supabaseClient';
import OfferForm from '../../../components/OfferForm';

export default function ShipmentDetailPage({ params }) {
  const router = useRouter();
  const [shipment, setShipment] = useState(null);
  const [offers, setOffers] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        setUser(session.user);

        // Get user profile
        const { data: profileData } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
      }

      // Fetch shipment details
      const { data: shipmentData, error: shipmentError } = await supabaseClient
        .from('shipments')
        .select('*')
        .eq('id', params.id)
        .single();

      if (shipmentError) throw shipmentError;
      setShipment(shipmentData);

      // Fetch offers for this shipment
      const { data: offersData, error: offersError } = await supabaseClient
        .from('offers')
        .select('*, profiles(email)')
        .eq('shipment_id', params.id)
        .order('created_at', { ascending: false });

      if (offersError) {
        console.error('Error fetching offers:', offersError);
      } else {
        setOffers(offersData || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (offerData) => {
    // Implementation for creating offers
    // This function could submit the offer via API
    console.log('Creating offer:', offerData);
  };

  const handleOfferSuccess = (newOffer) => {
    setOffers([newOffer, ...offers]);
    setSuccessMessage('Offer submitted successfully!');
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Shipment not found'}</p>
          <Link
            href="/shipments"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Back to Shipments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/shipments"
            className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block"
          >
            ← Back to Shipments
          </Link>
          <h1 className="text-3xl font-bold">Shipment Details</h1>
        </div>

        {/* Shipment Info Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-50">
                {shipment.pickup_location} → {shipment.delivery_location}
              </h2>
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
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

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">
                Pickup Date
              </h3>
              <p className="text-slate-50">{formatDate(shipment.pickup_date)}</p>
            </div>
            {shipment.delivery_date && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">
                  Delivery Date
                </h3>
                <p className="text-slate-50">{formatDate(shipment.delivery_date)}</p>
              </div>
            )}
          </div>

          {shipment.description && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">
                Description
              </h3>
              <p className="text-slate-300">{shipment.description}</p>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {shipment.weight && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-400 mb-1">
                  Weight
                </h3>
                <p className="text-slate-50">{shipment.weight} kg</p>
              </div>
            )}
            {shipment.dimensions && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-400 mb-1">
                  Dimensions
                </h3>
                <p className="text-slate-50">{shipment.dimensions}</p>
              </div>
            )}
            {shipment.price && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-400 mb-1">
                  Budget
                </h3>
                <p className="text-xl font-semibold text-emerald-400">
                  £{shipment.price}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            {successMessage}
          </div>
        )}

        {/* Offer Form - Only show for logged-in drivers on pending shipments */}
        {user && profile?.role === 'driver' && shipment.status === 'pending' && (
          <div className="mb-6">
            <OfferForm shipmentId={shipment.id} onSuccess={handleOfferSuccess} />
          </div>
        )}

        {/* Offers List */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            Offers ({offers.length})
          </h2>
          
          {offers.length === 0 ? (
            <p className="text-slate-400 text-center py-8">
              No offers yet for this shipment
            </p>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="border border-slate-700 rounded-lg p-4 bg-slate-800"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-slate-400">
                        From: {offer.profiles?.email || 'Unknown driver'}
                      </p>
                    </div>
                    <div className="text-xl font-semibold text-emerald-400">
                      £{offer.price}
                    </div>
                  </div>
                  {offer.estimated_delivery_date && (
                    <p className="text-sm text-slate-300 mb-2">
                      Estimated delivery: {formatDate(offer.estimated_delivery_date)}
                    </p>
                  )}
                  {offer.notes && (
                    <p className="text-sm text-slate-300">{offer.notes}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Submitted: {formatDate(offer.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
