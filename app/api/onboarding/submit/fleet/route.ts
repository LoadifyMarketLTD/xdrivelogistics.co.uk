import type { NextRequest } from 'next/server';

import { buildSubmitHandler } from '../../_lib/handlers';
import { fleetPayloadSchema } from '../../_lib/schemas';
import { requireUploadedOnboardingDocuments } from '../_lib/requireDocuments';

const submit = buildSubmitHandler({
  expectedAccountType: 'fleet_courier',
  payloadSchema: fleetPayloadSchema,
});

export async function POST(request: NextRequest) {
  const blocked = await requireUploadedOnboardingDocuments(request, 'fleet_courier');
  if (blocked) return blocked;
  return submit(request);
}
