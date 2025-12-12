import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '../../../lib/supabaseClient'
import { verifyAuth, getUserProfile } from '../../../lib/auth'

// POST /api/offers - Create a new offer for a shipment
export async function POST(request) {
  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a driver
    const { profile, error: profileError } = await getUserProfile(user.id)
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'driver') {
      return NextResponse.json(
        { error: 'Only drivers can create offers' },
        { status: 403 }
      )
    }

    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { shipment_id, price, notes, estimated_delivery_date } = body

    // Validate required fields
    if (!shipment_id || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: shipment_id, price' },
        { status: 400 }
      )
    }

    // Verify shipment exists
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status')
      .eq('id', shipment_id)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    if (shipment.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot create offer for non-pending shipment' },
        { status: 400 }
      )
    }

    // Create offer in database
    const { data, error } = await supabase
      .from('offers')
      .insert({
        shipment_id,
        driver_id: user.id,
        price,
        notes,
        estimated_delivery_date,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating offer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/offers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/offers - List offers with optional filters
export async function GET(request) {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const shipmentId = searchParams.get('shipmentId')
    const driverId = searchParams.get('driverId')
    const status = searchParams.get('status')

    let query = supabase
      .from('offers')
      .select('*, shipments(*)')
      .order('created_at', { ascending: false })

    // Apply filters
    if (shipmentId) {
      query = query.eq('shipment_id', shipmentId)
    }
    if (driverId) {
      query = query.eq('driver_id', driverId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching offers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/offers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
