"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseClient } from '../../lib/supabaseClient';
import ShipmentCard from '../../components/ShipmentCard';
import { formatStatus } from '../../lib/utils';

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchShipments();
  }, [statusFilter]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      let query = supabaseClient
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setShipments(data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">All Shipments</h1>
            <p className="text-slate-400 mt-1">
              Browse available delivery opportunities
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm font-medium transition"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex gap-2">
            {['all', 'pending', 'accepted', 'in_transit', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  statusFilter === status
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {status === 'all' ? 'All' : formatStatus(status)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Shipments Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-slate-400">Loading shipments...</div>
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-lg">
            <p className="text-slate-400">No shipments found</p>
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
  );
}
