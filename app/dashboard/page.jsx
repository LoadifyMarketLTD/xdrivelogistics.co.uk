"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '../../lib/supabaseClient';
import ShipmentCard from '../../components/ShipmentCard';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      // Check if supabase is configured
      if (!supabaseClient) {
        throw new Error('Database service is not configured');
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      // Get user profile
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setProfile(profileData);
      }

      // Fetch shipments based on role
      await fetchShipments(session.user.id, profileData?.role);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchShipments = async (userId, role) => {
    try {
      let query = supabaseClient.from('shipments').select('*');
      
      if (role === 'driver') {
        query = query.eq('driver_id', userId);
      } else if (role === 'client') {
        query = query.eq('client_id', userId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setShipments(data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Welcome back, {user?.email}
              {profile?.role && ` (${profile.role})`}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/shipments"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm font-medium transition"
            >
              All Shipments
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Stats Cards */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Total Shipments</h3>
            <p className="text-3xl font-bold">{shipments.length}</p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Active</h3>
            <p className="text-3xl font-bold">
              {shipments.filter(s => s.status === 'in_transit' || s.status === 'pending').length}
            </p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold">
              {shipments.filter(s => s.status === 'delivered').length}
            </p>
          </div>
        </div>

        {/* Recent Shipments */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Recent Shipments</h2>
          {shipments.length === 0 ? (
            <div className="bg-slate-900 rounded-lg p-8 border border-slate-800 text-center">
              <p className="text-slate-400">No shipments found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shipments.slice(0, 6).map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
