"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '../../lib/supabaseClient';
import ShipmentCard from '../../components/ShipmentCard';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
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
    } catch (err) {
      setError(err.message);
      setUser(user);
      await loadShipments(user.id);
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchShipments = async (userId, role) => {
    try {
      let query = supabaseClient
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      // If shipper, show their own shipments
      if (role === 'shipper') {
        query = query.eq('user_id', userId);
      }
      // If driver, show all pending shipments
      else if (role === 'driver') {
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query;

      if (error) throw error;
      setShipments(data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
      setError(err.message);
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
    await supabaseClient.auth.signOut();
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

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {profile?.role === 'shipper' && (
            <Link
              href="/shipments/new"
              className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition"
            >
              <h3 className="text-lg font-semibold text-emerald-400 mb-2">
                Create New Shipment
              </h3>
              <p className="text-sm text-slate-300">
                Post a new delivery request and receive offers from drivers
              </p>
            </Link>
          )}
          
          <Link
            href="/shipments"
            className="p-6 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition"
          >
            <h3 className="text-lg font-semibold text-slate-50 mb-2">
              Browse All Shipments
            </h3>
            <p className="text-sm text-slate-300">
              View available shipments and delivery opportunities
            </p>
          </Link>
        </div>

        {/* Shipments List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {profile?.role === 'shipper' ? 'Your Shipments' : 'Available Shipments'}
          </h2>
          
          {shipments.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-lg">
              <p className="text-slate-400">No shipments found</p>
              {profile?.role === 'shipper' && (
                <Link
                  href="/shipments/new"
                  className="inline-block mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-md text-sm font-medium"
                >
                  Create Your First Shipment
                </Link>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shipments.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
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
