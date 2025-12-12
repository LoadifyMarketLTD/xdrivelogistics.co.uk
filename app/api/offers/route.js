import { NextResponse } from 'next/server'
import { createServerSupabase } from '../../../lib/supabaseClient'

/**
 * GET /api/offers
 * Returns a list of offers with optional shipmentId filter
 * Query params: shipmentId
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const shipmentId = searchParams.get('shipmentId')

    const supabase = createServerSupabase()
    
    let query = supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })

    if (shipmentId) {
      query = query.eq('shipment_id', shipmentId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching offers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ offers: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/offers
 * Creates a new offer (requires authentication and driver role)
 * Body: { shipment_id, price, notes }
 */
export async function POST(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createServerSupabase()

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Check if user has driver role (stored in user_metadata or a separate table)
    // For MVP, we'll check user_metadata.role
    const role = user.user_metadata?.role
    if (role !== 'driver') {
      return NextResponse.json(
        { error: 'Only drivers can create offers' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { shipment_id, price, notes } = body

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

    if (shipment.status !== 'open') {
      return NextResponse.json(
        { error: 'Shipment is not open for offers' },
        { status: 400 }
      )
    }

    // Insert offer
    const { data, error } = await supabase
      .from('offers')
      .insert([
        {
          shipment_id,
          driver_id: user.id,
          price: parseFloat(price),
          notes: notes || null,
          status: 'pending'
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating offer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ offer: data }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
