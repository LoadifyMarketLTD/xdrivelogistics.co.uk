import { NextRequest } from 'next/server';
import { authorizeCrm, crmIsolatedWriteEnabled, crmResponse } from '../_lib/server';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  return crmResponse(200,{staging_writes_enabled:crmIsolatedWriteEnabled(),
    production_writes_enabled:false,send_api_enabled:false});
}
