'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import { AlertBanner, EmptyState, PageFrame } from './WorkspaceUI';
import DemoDriversBoard from '../../try-xdrive-demo/components/DemoDriversBoard';
import DemoFleetBoard from '../../try-xdrive-demo/components/DemoFleetBoard';

type Vehicle = {
  id: string; reg_plate: string | null; type: string | null;
  body_type: string | null; payload_kg: number | null; pallets_capacity: number | null;
  has_tail_lift: boolean | null; assigned_driver_id: string | null; is_available: boolean | null;
};
type Driver = {
  id: string; display_name: string | null; status: string | null; availability_status: string | null;
};
type FleetResponse = { companyId?: string; vehicles?: Vehicle[]; drivers?: Driver[]; documents?: Array<{id:string;vehicle_id:string|null;doc_type:string|null;status:string|null;expiry_date:string|null}>; driverDocuments?: Array<{id:string;driver_id:string|null;doc_type:string|null;status:string|null;expiry_date:string|null}>; documentsUnavailable?: boolean; documentsRestricted?: boolean; limited?: boolean; error?: string; access?: string };

export default function MemberFleetOverview({ section, canManage = false, manageHref }: { section: 'fleet'|'drivers'; canManage?: boolean; manageHref?: string }) {
  const data = useCompanyWorkspaceData();
  const [fleet,setFleet] = useState<FleetResponse | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
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
        const response = await fetch(`/api/workspace/fleet-overview?companyId=${encodeURIComponent(companyId)}&includeDocuments=true`,{
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
  },[companyId,section]);

  const activeFleet = fleet?.companyId === companyId ? fleet : null;

  return <PageFrame>
    {error&&<AlertBanner tone="warning">{error}</AlertBanner>}
    {loading||!activeFleet ? <EmptyState title={loading?'Loading company records':'Company records unavailable'} /> : (
      section === 'fleet'
        ? <DemoFleetBoard
            verifiedFleet={{ vehicles: activeFleet.vehicles ?? [], drivers: activeFleet.drivers ?? [], documents: activeFleet.documents ?? [], documentsUnavailable: activeFleet.documentsUnavailable === true, documentsRestricted: activeFleet.documentsRestricted === true, limited: activeFleet.limited === true }}
            readOnly={!canManage} manageHref={manageHref}
          />
        : <DemoDriversBoard verifiedDrivers={{drivers:activeFleet.drivers ?? [],vehicles:activeFleet.vehicles ?? [],documents:activeFleet.driverDocuments ?? [],documentsUnavailable:activeFleet.documentsUnavailable === true,documentsRestricted:activeFleet.documentsRestricted === true,limited:activeFleet.limited === true}} readOnly={!canManage} manageHref={manageHref}/>

    )}
  </PageFrame>;
}
