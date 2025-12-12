import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '../../../lib/supabaseClient'

// POST /api/shipments - Create a new shipment
export async function POST(request) {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Get authenticated user from request headers or session
    const authHeader = request.headers.get('authorization')
    let userId = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    } else {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      pickup_location,
      delivery_location,
      pickup_date,
      delivery_date,
      weight,
      dimensions,
      description,
      price,
    } = body

    // Validate required fields
    if (!pickup_location || !delivery_location || !pickup_date) {
      return NextResponse.json(
        { error: 'Missing required fields: pickup_location, delivery_location, pickup_date' },
        { status: 400 }
      )
    }

    // Create shipment in database
    const { data, error } = await supabase
      .from('shipments')
      .insert({
        user_id: userId,
        pickup_location,
        delivery_location,
        pickup_date,
        delivery_date,
        weight,
        dimensions,
        description,
        price,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating shipment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/shipments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/shipments - List shipments with optional filters
export async function GET(request) {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    let query = supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching shipments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/shipments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
