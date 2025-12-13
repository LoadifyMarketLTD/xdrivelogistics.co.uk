"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAuthenticated, logout, getBookings, getDashboardStats } from '../../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }

      const currentUser = getCurrentUser();
      setUser(currentUser);

      // Fetch bookings from Express backend
      const bookingsData = await getBookings({ limit: 10 });
      setBookings(bookingsData || []);

      // Fetch dashboard stats
      const statsData = await getDashboardStats();
      setStats(statsData || {});
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
      // If API call fails with auth error, redirect to login
      if (error.message.includes('401') || error.message.includes('403')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
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
              {user?.account_type && ` (${user.account_type})`}
            </p>
          </div>
          <div className="flex gap-3">
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
            <h3 className="text-sm font-medium text-slate-400 mb-2">Total Bookings</h3>
            <p className="text-3xl font-bold">{stats?.total_bookings || bookings.length}</p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Active</h3>
            <p className="text-3xl font-bold">
              {bookings.filter(b => b.status === 'In Transit' || b.status === 'Pending').length}
            </p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Completed</h3>
            <p className="text-3xl font-bold">
              {bookings.filter(b => b.status === 'Delivered').length}
            </p>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Recent Bookings</h2>
          {bookings.length === 0 ? (
            <div className="bg-slate-900 rounded-lg p-8 border border-slate-800 text-center">
              <p className="text-slate-400">No bookings found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.slice(0, 6).map((booking) => (
                <div key={booking.id} className="bg-slate-900 rounded-lg p-6 border border-slate-800">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{booking.load_id}</h3>
                      <p className="text-sm text-slate-400">{booking.vehicle_type}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                      booking.status === 'In Transit' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-300">
                      <span className="text-slate-500">From:</span> {booking.from_address}
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">To:</span> {booking.to_address}
                    </p>
                    {booking.price && (
                      <p className="text-slate-300 mt-2">
                        <span className="text-slate-500">Price:</span> £{parseFloat(booking.price).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
