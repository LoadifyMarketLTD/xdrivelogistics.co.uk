// app/driver/dashboard/page.jsx
export const metadata = {
  title: "Driver Dashboard | XDrive Logistics",
  description: "Driver dashboard – active jobs, profile and history",
};

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
export default function DriverDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Driver Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Welcome back, Daniel Preda
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Driver Card */}
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <img
              src="/driver.jpg"
              alt="Driver"
              className="mx-auto h-24 w-24 rounded-full object-cover"
            />
            <h2 className="mt-4 text-lg font-semibold">
              Daniel Preda
            </h2>
            <p className="text-sm text-gray-500">Driver</p>

            <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
              Go Offline
            </button>
          </div>

          {/* Active Job Card */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-3">Active Job</h3>
            <div className="text-sm space-y-2">
              <p><strong>#29345</strong></p>
              <p>Pickup: Glasgow</p>
              <p>Delivery: Newcastle</p>
              <p className="text-gray-500">
                15/12/2023 • 14:00 – 18:30
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* Driver Info */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-4">Driver Info</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p>danie@example.com</p>
              </div>

      if (error) throw error;
      setShipments(data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push('/login');
  };
              <div>
                <p className="text-gray-500">Phone</p>
                <p>+44 7123 45789</p>
              </div>

              <div>
                <p className="text-gray-500">Vehicle</p>
                <p>Mercedes Sprinter LWB</p>
              </div>

              <div>
                <p className="text-gray-500">Registration</p>
                <p>SF19 WZC</p>
              </div>

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
              <div>
                <p className="text-gray-500">Rating</p>
                <p>★★★★★</p>
              </div>

              <div>
                <p className="text-gray-500">Verification</p>
                <p>ID + Full Insurance</p>
              </div>
            </div>
          </div>

          {/* Active Jobs Table */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-4">Active Jobs</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Job</th>
                    <th className="pb-2">Pickup</th>
                    <th className="pb-2">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2">#29345</td>
                    <td>Glasgow</td>
                    <td>Newcastle</td>
                  </tr>
                  <tr>
                    <td className="py-2">#29304</td>
                    <td>Liverpool</td>
                    <td>Glasgow</td>
                  </tr>
                  <tr>
                    <td className="py-2">#29287</td>
                    <td>Manchester</td>
                    <td>Edinburgh</td>
                  </tr>
                  <tr>
                    <td className="py-2">#29256</td>
                    <td>Birmingham</td>
                    <td>Derby</td>
                  </tr>
                  <tr>
                    <td className="py-2">#29236</td>
                    <td>York</td>
                    <td>Inverness</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Job History */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-4">Job History</h3>
            <p className="text-sm text-gray-500">
              Completed jobs will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
