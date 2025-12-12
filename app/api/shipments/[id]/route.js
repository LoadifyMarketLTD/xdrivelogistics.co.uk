import { NextResponse } from 'next/server'
import { createServerSupabase } from '../../../../lib/supabaseClient'

/**
 * GET /api/shipments/[id]
 * Returns shipment details including associated offers
 */
export async function GET(request, { params }) {
  try {
    const { id } = params
    const supabase = createServerSupabase()

    // Fetch shipment with offers
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single()

    if (shipmentError) {
      if (shipmentError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
      }
      console.error('Error fetching shipment:', shipmentError)
      return NextResponse.json({ error: shipmentError.message }, { status: 500 })
    }

    // Fetch associated offers
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('*')
      .eq('shipment_id', id)
      .order('created_at', { ascending: false })

    if (offersError) {
      console.error('Error fetching offers:', offersError)
      // Continue without offers rather than failing
    }

    return NextResponse.json({
      shipment,
      offers: offers || []
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
