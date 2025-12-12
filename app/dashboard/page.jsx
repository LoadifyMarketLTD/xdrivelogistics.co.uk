"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      await loadShipments(user.id);
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadShipments = async (userId) => {
    try {
      const response = await fetch(`/api/shipments?userId=${userId}`);
      const data = await response.json();
      setShipments(data.shipments || []);
    } catch (error) {
      console.error('Error loading shipments:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const userRole = user?.user_metadata?.role || 'driver';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-xs font-semibold">
              XDL
            </div>
            <div>
              <div className="text-sm font-semibold">Dashboard</div>
              <div className="text-xs text-slate-400 capitalize">{userRole}</div>
            </div>
          </div>
          <div className="flex gap-4">
            <Link
              href="/shipments"
              className="px-4 py-2 text-sm text-slate-300 hover:text-slate-50"
            >
              Browse Shipments
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-slate-300 hover:text-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">
            {userRole === 'shipper' ? 'Your Shipments' : 'Available Loads'}
          </h1>
          <p className="text-sm text-slate-400">
            {userRole === 'shipper' 
              ? 'Manage your shipments and view offers from drivers'
              : 'Browse available shipments and submit your offers'}
          </p>
        </div>

        {/* Shipments List */}
        {shipments.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 text-center">
            <p className="text-slate-400 mb-4">
              {userRole === 'shipper' 
                ? "You haven't created any shipments yet"
                : "No shipments available at the moment"}
            </p>
            {userRole === 'shipper' && (
              <Link
                href="/shipments"
                className="inline-block px-6 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-md hover:bg-emerald-400"
              >
                Create Shipment
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                className="bg-slate-900/50 border border-slate-800 rounded-lg p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      {shipment.pickup_location} → {shipment.delivery_location}
                    </h3>
                    <p className="text-sm text-slate-400">
                      Pickup: {new Date(shipment.pickup_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-xs">
                    {shipment.status}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-slate-400">
                  <div>Cargo: {shipment.cargo_type}</div>
                  <div>Weight: {shipment.weight}kg</div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/shipments/${shipment.id}`}
                    className="text-emerald-500 hover:text-emerald-400 text-sm"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
