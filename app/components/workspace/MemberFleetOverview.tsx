'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import { ActionButton, AlertBanner, EmptyState, PageFrame } from './WorkspaceUI';
import Master3150RealFleetBoard from './Master3150RealFleetBoard';

type Vehicle = {
  id: string; reg_plate: string | null; type: string | null;
  body_type: string | null; payload_kg: number | null; pallets_capacity: number | null;
  has_tail_lift: boolean | null; assigned_driver_id: string | null;
};
type Driver = {
  id: string; display_name: string | null; status: string | null; availability_status: string | null;
};
type FleetResponse = { companyId?: string; vehicles?: Vehicle[]; drivers?: Driver[]; limited?: boolean; error?: string; access?: string };

export default function MemberFleetOverview({ section, canManage = false, manageHref }: { section: 'fleet'|'drivers'; canManage?: boolean; manageHref?: string }) {
  const data = useCompanyWorkspaceData();
  const [fleet,setFleet] = useState<FleetResponse | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value)=>value+1),[]);
  const companyId = data.companyId;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setFleet(null); setError(''); setLoading(true);
      if (!companyId) {
        if (alive) {setError('Company membership is unavailable.');setLoading(false);}
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        if (alive) {setError('Your session has expired.');setLoading(false);}
        return;
      }
      try {
        const response = await fetch(`/api/workspace/fleet-overview?companyId=${encodeURIComponent(companyId)}`,{
          headers:{Authorization:`Bearer ${token}`}, cache:'no-store'
        });
        const body = await response.json().catch(()=>null) as FleetResponse | null;
        if (!response.ok) throw new Error(body?.error||'Company fleet information could not be verified.');
        if (body?.companyId!==companyId || !Array.isArray(body.vehicles)||!Array.isArray(body.drivers))
          throw new Error('Fleet data did not match the active company.');
        if(alive)setFleet(body);
      } catch(reason) {
        if(alive) {setFleet(null);setError(reason instanceof Error?reason.message:'Fleet unavailable.');}
      } finally {if(alive)setLoading(false);}
    };
    void load();
    return ()=>{alive=false;};
  },[companyId,revision]);

  return <PageFrame>
    <div className="master3150-real-fleet-controls">
      <span>Verified company records · Access restricted to the active company</span>
      <ActionButton tone="secondary" disabled={loading} onClick={refresh}>Refresh</ActionButton>
    </div>
    {error&&<AlertBanner tone="warning">{error}</AlertBanner>}
    {loading||!fleet ? <EmptyState title={loading?'Loading company records':'Company records unavailable'} /> : (
      <Master3150RealFleetBoard section={section} vehicles={fleet.vehicles??[]} drivers={fleet.drivers??[]}
        canManage={canManage} manageHref={manageHref} limited={fleet.limited === true}/>
    )}
  </PageFrame>;
}
