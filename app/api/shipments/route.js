import { NextResponse } from 'next/server'
import { createServerSupabase } from '../../../lib/supabaseClient'

/**
 * GET /api/shipments
 * Returns a list of shipments with optional filtering
 * Query params: status, limit
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createServerSupabase()
    
    let query = supabase
      .from('shipments')
      .select('id, title, description, origin, destination, price_estimate, status, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching shipments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ shipments: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/shipments
 * Creates a new shipment (requires authentication)
 * Body: { title, description, origin, destination, price_estimate }
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

    // Parse and validate request body
    const body = await request.json()
    const { title, description, origin, destination, price_estimate } = body

    if (!title || !origin || !destination) {
      return NextResponse.json(
        { error: 'Missing required fields: title, origin, destination' },
        { status: 400 }
      )
    }

    // Insert shipment
    const { data, error } = await supabase
      .from('shipments')
      .insert([
        {
          title,
          description: description || null,
          origin,
          destination,
          price_estimate: price_estimate ? parseFloat(price_estimate) : null,
          created_by: user.id,
          status: 'open'
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating shipment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ shipment: data }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
