import { NextRequest } from 'next/server';
import { submitInvoice } from '../../../../../../../lib/server/invoiceDelivery';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return submitInvoice(request, context);
}
