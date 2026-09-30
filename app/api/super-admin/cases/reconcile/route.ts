import { NextRequest, NextResponse } from 'next/server';

import { reconcileJobExceptions } from '@/lib/exception-closure/reconcileJobExceptions';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  if (isSuperAdminDeployPreviewReadOnly()) {
    return respond(403, {
      error: 'Deploy Preview is read-only. Exception reconciliation was not performed.',
    });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }
  const result = await reconcileJobExceptions(supabaseAdmin, owner.id);

  if (result.errors.length > 0) {
    return respond(500, {
      error: 'Exception reconciliation completed with errors.',
      reconciliation: result,
    });
  }

  return respond(200, {
    reconciliation: result,
  });
}
