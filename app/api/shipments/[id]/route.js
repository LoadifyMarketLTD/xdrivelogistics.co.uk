import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

// GET /api/shipments/[id] - Get shipment details
export async function GET(request, { params }) {
  try {
    const supabase = createServerSupabaseClient()
    const { id } = params
    
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    
    return NextResponse.json({ shipment: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
