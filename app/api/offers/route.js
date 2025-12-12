import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

// GET /api/offers - List offers for a shipment
export async function GET(request) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const shipmentId = searchParams.get('shipmentId')
    
    if (!shipmentId) {
      return NextResponse.json(
        { error: 'shipmentId parameter is required' }, 
        { status: 400 }
      )
    }
    
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ offers: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/offers - Create a new offer
export async function POST(request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    const { shipment_id, driver_id, price, notes } = body
    
    if (!shipment_id || !driver_id || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: shipment_id, driver_id, price' }, 
        { status: 400 }
      )
    }
    
    // Create offer
    const { data, error } = await supabase
      .from('offers')
      .insert([
        {
          shipment_id,
          driver_id,
          price: parseFloat(price),
          notes: notes || '',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ offer: data[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
