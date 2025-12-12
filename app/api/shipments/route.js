import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

// GET /api/shipments - List shipments
export async function GET(request) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    // Optional filters
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    
    let query = supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ shipments: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/shipments - Create a new shipment
export async function POST(request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    const { 
      pickup_location, 
      delivery_location, 
      pickup_date,
      cargo_type,
      weight,
      user_id 
    } = body
    
    if (!pickup_location || !delivery_location || !pickup_date || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      )
    }
    
    // Create shipment
    const { data, error } = await supabase
      .from('shipments')
      .insert([
        {
          user_id,
          pickup_location,
          delivery_location,
          pickup_date,
          cargo_type: cargo_type || 'general',
          weight: weight || 0,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ shipment: data[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
