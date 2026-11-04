'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader } from './WorkspaceUI';

type Vehicle = {
  id: string; reg_plate: string | null; type: string | null;
  body_type: string | null; payload_kg: number | null; pallets_capacity: number | null;
  has_tail_lift: boolean | null; assigned_driver_id: string | null;
};
type Driver = {
  id: string; display_name: string | null; status: string | null; availability_status: string | null;
};
type FleetResponse = { companyId?: string; vehicles?: Vehicle[]; drivers?: Driver[]; limited?: boolean; error?: string; access?: string };

export default function MemberFleetOverview({ section }: { section: 'fleet'|'drivers' }) {
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

  const driversById = useMemo(()=>new Map((fleet?.drivers||[]).map((driver)=>[driver.id,driver.display_name||'Not recorded'])),[fleet]);
  const unavailable = loading || !!error || !fleet || fleet.limited === true;
  const rows = section==='fleet'
    ? (fleet?.vehicles||[]).map((vehicle)=>[
      vehicle.reg_plate||'Not recorded',vehicle.type||'Not recorded',vehicle.body_type||'Not recorded',
      vehicle.payload_kg != null ? `${vehicle.payload_kg} kg`:'Not recorded',
      vehicle.pallets_capacity != null ? `${vehicle.pallets_capacity} pallets`:'Not recorded',
      vehicle.assigned_driver_id?driversById.get(vehicle.assigned_driver_id)||'Not verified':'Unassigned'
    ])
    : (fleet?.drivers||[]).map((driver)=>[
      driver.display_name||'Not recorded',driver.status||'Not recorded',
      driver.availability_status||'Not recorded',
      (fleet?.vehicles||[]).filter(vehicle=>vehicle.assigned_driver_id===driver.id).map(vehicle=>vehicle.reg_plate||vehicle.type||'Vehicle').join(', ')||'No assigned vehicle'
    ]);

  return <PageFrame>
    <PageHeader title={section==='fleet'?'My Fleet':'Drivers'}
      eyebrow="XDrive Logistics / Verified company records"
      description="Own-company fleet and driver records only. This read-only view does not grant administrative permissions."
      actions={<ActionButton tone="secondary" disabled={loading} onClick={refresh}>Refresh</ActionButton>} />
    {error&&<AlertBanner tone="warning">{error}</AlertBanner>}
    {fleet?.limited&&<AlertBanner tone="warning">This company has more records than can be safely verified in one request. Complete totals are unavailable.</AlertBanner>}
    <div className="xd-fleet-metrics" style={{marginBottom:15,display:'flex',gap:12,flexWrap:'wrap'}}>
      <div className="workspace-panel" style={{padding:12}}>Vehicles <strong>{unavailable?'Unavailable':fleet.vehicles?.length}</strong></div>
      <div className="workspace-panel" style={{padding:12}}>Drivers <strong>{unavailable?'Unavailable':fleet.drivers?.length}</strong></div>
      <div className="workspace-panel" style={{padding:12}}>Access <strong>Own company only</strong></div>
    </div>
    <DataTable
      columns={section==='fleet'?['Registration','Vehicle','Body','Payload','Capacity','Assigned driver']:['Driver','Status','Availability','Assigned vehicle']}
      rows={unavailable?[]:rows}
      empty={<EmptyState title={loading?'Loading company records':error?'Company records unavailable':fleet?.limited?'Incomplete company records':section==='fleet'?'No registered company vehicles':'No registered company drivers'} />}
    />
  </PageFrame>;
}
