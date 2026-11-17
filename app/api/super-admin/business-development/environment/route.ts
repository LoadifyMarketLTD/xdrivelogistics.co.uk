import { NextRequest } from 'next/server';
import { authorizeCrm, crmWriteEnabled, crmResponse } from '../_lib/server';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  return crmResponse(200,{writes_enabled:crmWriteEnabled(),
    production_writes_enabled:process.env.CONTEXT==='production' && crmWriteEnabled(),
    send_api_enabled:false});
}
