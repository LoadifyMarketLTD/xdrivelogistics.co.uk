import type { NextRequest } from 'next/server';

import { buildSubmitHandler } from '../../_lib/handlers';
import { brokerPayloadSchema } from '../../_lib/schemas';
import { requireUploadedOnboardingDocuments } from '../_lib/requireDocuments';

const submit = buildSubmitHandler({
  expectedAccountType: 'broker_shipper',
  payloadSchema: brokerPayloadSchema,
});

export async function POST(request: NextRequest) {
  const blocked = await requireUploadedOnboardingDocuments(request, 'broker_shipper');
  if (blocked) return blocked;
  return submit(request);
}
