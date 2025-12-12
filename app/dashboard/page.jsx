'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import supabaseClient from '../../lib/supabaseClient'
import ShipmentCard from '../../components/ShipmentCard'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized')
      }

      const { data: { user }, error } = await supabaseClient.auth.getUser()

      if (error || !user) {
        router.push('/login')
        return
      }

      setUser(user)
      await fetchShipments(user)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const fetchShipments = async (user) => {
    try {
      const role = user.user_metadata?.role

      let url = '/api/shipments'
      if (role === 'shipper') {
        // For shippers, we would filter by created_by on the server
        // For now, fetch all and filter client-side
        url = '/api/shipments?limit=100'
      } else {
        // For drivers, show all available shipments
        url = '/api/shipments?status=open&limit=50'
      }

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        let filteredShipments = data.shipments || []
        
        // Filter shipper's own shipments
        if (role === 'shipper') {
          filteredShipments = filteredShipments.filter(s => s.created_by === user.id)
        }

        setShipments(filteredShipments)
      } else {
        throw new Error(data.error || 'Failed to fetch shipments')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  const role = user?.user_metadata?.role || 'unknown'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
            <p className="text-slate-400 text-sm">
              Welcome back, {user?.email} ({role})
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-md"
          >
            Log out
          </button>
        </div>

        {error && (
          <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded px-4 py-3">
            {error}
          </div>
        )}

        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {role === 'shipper' ? 'My Shipments' : 'Available Shipments'}
          </h2>
          {role === 'shipper' && (
            <a
              href="/shipments/new"
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md"
            >
              Create Shipment
            </a>
          )}
        </div>

        {shipments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg mb-2">No shipments found</p>
            {role === 'shipper' && (
              <p className="text-sm">Create your first shipment to get started</p>
            )}
            {role === 'driver' && (
              <p className="text-sm">Check back later for available shipments</p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shipments.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
