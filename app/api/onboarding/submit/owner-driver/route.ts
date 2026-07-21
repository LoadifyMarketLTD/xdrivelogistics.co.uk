import type { NextRequest } from 'next/server';

import { buildSubmitHandler } from '../../_lib/handlers';
import { ownerDriverPayloadSchema } from '../../_lib/schemas';
import { requireUploadedOnboardingDocuments } from '../_lib/requireDocuments';

const submit = buildSubmitHandler({
  expectedAccountType: 'owner_driver',
  payloadSchema: ownerDriverPayloadSchema,
});

export async function POST(request: NextRequest) {
  const blocked = await requireUploadedOnboardingDocuments(request, 'owner_driver');
  if (blocked) return blocked;
  return submit(request);
}
