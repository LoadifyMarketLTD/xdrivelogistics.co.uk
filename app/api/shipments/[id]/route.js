import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '../../../../lib/supabaseClient'

// GET /api/shipments/[id] - Get shipment details by ID
export async function GET(request, { params }) {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { id } = params

    
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
      }
      console.error('Error fetching shipment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/shipments/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
