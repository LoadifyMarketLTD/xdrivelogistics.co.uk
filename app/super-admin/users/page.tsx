'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { CANONICAL_ROLES } from '@/app/super-admin/settings/roles-permissions/rolesRegistry';

const X = { navy:'#0B2F6B', blue:'#1D57D8', orange:'#F5A300', white:'#FFFFFF', charcoal:'#1A1F2B', light:'#F4F6F8', border:'#D9E1EA', muted:'#64748B', danger:'#DC2626' } as const;

type DirectorySummary = {
  roleCounts?: Record<string, number>;
  activeRoleCounts?: Record<string, number>;
  summary?: { totalAuthorityGrants?: number; activeAuthorityGrants?: number; canonicalRoles?: number };
  diagnosticNote?: string | null;
  error?: string;
};

function AllUsersContent() {
  const router = useRouter();
  const [directory, setDirectory] = useState<DirectorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch('/api/super-admin/users/canonical?limit=1', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as DirectorySummary;
      if (!response.ok) {
        setDirectory(null);
        setError(body.error ?? 'Canonical authority directory is unavailable.');
        return;
      }
      setDirectory(body);
    } catch {
      setDirectory(null);
      setError('Canonical authority directory is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalLabel = loading
    ? 'Loading canonical authority…'
    : directory?.summary
      ? `${directory.summary.activeAuthorityGrants ?? 0} active of ${directory.summary.totalAuthorityGrants ?? 0} authority grants across ${directory.summary.canonicalRoles ?? CANONICAL_ROLES.length} canonical roles.`
      : 'Canonical authority counts unavailable.';

  return <div style={{minHeight:'100vh',background:X.light,color:X.charcoal,padding:'12px'}}>
    <header style={{minHeight:'52px',display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
      <span aria-hidden='true' style={{width:'28px',height:'28px',display:'grid',placeItems:'center',borderRadius:'4px',background:X.navy,color:X.white,fontSize:'12px'}}>👥</span>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          <h1 style={{margin:0,color:X.navy,fontSize:'20px',lineHeight:1.2,fontWeight:800}}>Canonical User Authority</h1>
          <span style={{padding:'3px 6px',borderRadius:'4px',background:'#EEF4FF',color:X.blue,fontSize:'10px',fontWeight:800,letterSpacing:'.05em',textTransform:'uppercase'}}>Platform</span>
        </div>
        <p style={{margin:'4px 0 0',color:X.muted,fontSize:'12px'}}>{totalLabel}</p>
      </div>
    </header>

    {error ? <div role="alert" style={{marginBottom:'12px',border:'1px solid #F1B8B8',borderLeft:`4px solid ${X.danger}`,borderRadius:'4px',background:X.white,padding:'9px 12px',fontSize:'11px',color:X.danger}}>{error} Counts are not replaced with fabricated zeroes.</div> : null}
    {directory?.diagnosticNote ? <div style={{marginBottom:'12px',border:`1px solid ${X.border}`,borderLeft:`4px solid ${X.orange}`,borderRadius:'4px',background:X.white,padding:'9px 12px',fontSize:'11px',color:X.charcoal}}>{directory.diagnosticNote}</div> : null}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:'12px'}}>
      {CANONICAL_ROLES.map((role) => {
        const total = directory?.roleCounts?.[role.workspaceRole];
        const active = directory?.activeRoleCounts?.[role.workspaceRole];
        return <button key={role.workspaceRole} onClick={()=>router.push(`/super-admin/users/roles/${encodeURIComponent(role.workspaceRole)}`)} style={{minHeight:'126px',textAlign:'left',cursor:'pointer',background:X.white,border:`1px solid ${X.border}`,borderRadius:'4px',padding:'12px',color:X.charcoal}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',marginBottom:'8px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',minWidth:0}}><span style={{width:'28px',height:'28px',display:'grid',placeItems:'center',borderRadius:'4px',background:X.light}}>{role.emoji}</span><strong style={{fontSize:'12px',color:X.navy}}>{role.label}</strong></div>
            <span style={{fontSize:'10px',fontWeight:800,color:X.blue,whiteSpace:'nowrap'}}>{loading || !directory ? '—' : `${active ?? 0}/${total ?? 0}`}</span>
          </div>
          <div style={{color:X.muted,fontSize:'11px',lineHeight:1.45,minHeight:'48px'}}>{role.description}</div>
          <div style={{marginTop:'8px',display:'flex',justifyContent:'space-between',gap:'8px',alignItems:'center'}}>
            <span style={{fontSize:'9px',fontWeight:800,textTransform:'uppercase',color:X.muted}}>{role.accessLevel}</span>
            <span style={{fontSize:'11px',fontWeight:800,color:X.blue}}>Inspect authority →</span>
          </div>
        </button>;
      })}
    </section>
  </div>;
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><AllUsersContent /></ProtectedRoute>;
}
